import { getLogger } from './logger'
import { sequenceMatcherRatio } from './similarity'

const logger = getLogger('validator')

const NON_LATIN_RANGES: [number, number][] = [
	[0x0600, 0x06ff], // Arabic
	[0x0900, 0x097f], // Devanagari
	[0x0a00, 0x0a7f], // Gurmukhi
	[0x0a80, 0x0aff], // Gujarati
	[0x0b00, 0x0b7f], // Oriya
	[0x0b80, 0x0bff], // Tamil
	[0x0c00, 0x0c7f], // Telugu
	[0x0c80, 0x0cff], // Kannada
	[0x0d00, 0x0d7f], // Malayalam
	[0x0e00, 0x0e7f], // Thai
	[0x0f00, 0x0fff], // Tibetan
	[0x1100, 0x11ff], // Hangul Jamo
	[0x3000, 0x9fff], // CJK
	[0xac00, 0xd7af], // Hangul Syllables
	[0x0400, 0x04ff], // Cyrillic
	[0x0370, 0x03ff], // Greek
	[0x0590, 0x05ff], // Hebrew
]

const EXTENSION_RE =
	/^(?:feat(?:uring|\.?)?|ft\.?|remix|live|acoustic|cover|version|edit|radio|official|remastered?|bonus|alt\.?|instrumental|extended|deluxe|explicit|clean)\b/i

function hasNonLatin(text: string): boolean {
	if (!text) return false
	const count = [...text].filter((c) =>
		NON_LATIN_RANGES.some(([lo, hi]) => {
			const cp = c.codePointAt(0) ?? 0
			return cp >= lo && cp <= hi
		}),
	).length
	return count > Math.max(1, text.length * 0.2)
}

function normalizeString(text: string): string {
	if (!text) return ''
	return text
		.normalize('NFC')
		.replace(/[^\w\s]/gu, '')
		.replace(/\s+/g, ' ')
		.toLowerCase()
		.trim()
}

function splitArtists(artistStr: string): string[] {
	if (!artistStr) return []
	const s = artistStr.replace(/\s*(feat\.|ft\.|featuring|with|&|and)\s*/gi, ', ')
	const seen = new Set<string>()
	const result: string[] = []
	for (const part of s.split(/\s*[,;/]\s*/)) {
		const n = normalizeString(part)
		if (n && !seen.has(n)) {
			seen.add(n)
			result.push(n)
		}
	}
	return result
}

function extractArtistSongFromResult(result: Record<string, unknown>): [string[], string] {
	const artist = result.artist ?? result.artists ?? result.artist_name ?? result.trackArtist
	const song = result.song ?? result.song_title ?? result.title ?? result.name ?? result.trackName

	let artists: string[]
	if (Array.isArray(artist)) {
		const seen = new Set<string>()
		artists = []
		for (const a of artist) {
			const n = normalizeString(String(a))
			if (n && !seen.has(n)) {
				seen.add(n)
				artists.push(n)
			}
		}
	} else if (typeof artist === 'string') {
		artists = splitArtists(artist)
	} else {
		artists = []
	}

	return [artists, normalizeString(String(song ?? ''))]
}

function getSimilarityRatio(s1: string, s2: string): number {
	const a = normalizeString(s1)
	const b = normalizeString(s2)
	if (!a || !b) return 0.0
	let sim = sequenceMatcherRatio(a, b)
	if (b.length > a.length * 1.5) {
		sim *= 0.5 + 0.5 * (a.length / b.length)
	}
	return sim
}

function adaptiveThreshold(text: string, base: number): number {
	const n = normalizeString(text).length
	if (n <= 4) return Math.max(0.4, base - 0.35)
	if (n <= 6) return Math.max(0.5, base - 0.2)
	if (n <= 10) return Math.max(0.6, base - 0.1)
	return base
}

function isExtensionSuffix(returned: string, requested: string): boolean {
	const req = normalizeString(requested)
	const ret = normalizeString(returned)
	if (!ret.startsWith(req)) return false
	const suffix = ret.slice(req.length).trim()
	if (!suffix) return false
	return EXTENSION_RE.test(suffix)
}

export interface ValidationResult {
	valid: boolean
	reason: string
	artist_match: number
	song_match: number
	returned_artists: string[]
	returned_song: string
	script_mismatch: boolean
}

function ok(
	reason: string,
	artistMatch: number,
	songMatch: number,
	retArtists: string[],
	retSong: string,
	scriptMismatch: boolean,
): ValidationResult {
	return {
		valid: true,
		reason,
		artist_match: Math.round(artistMatch * 1000) / 1000,
		song_match: Math.round(songMatch * 1000) / 1000,
		returned_artists: retArtists,
		returned_song: retSong,
		script_mismatch: scriptMismatch,
	}
}

function findArtistMatch(
	reqArtists: string[],
	retArtists: string[],
	retSong: string,
	normReqArtist: string,
	artistThresh: number,
	isExtension: boolean,
): { found: boolean; bestArtist: number; method: string } {
	if (!retArtists.length) {
		return { found: true, bestArtist: 0, method: 'No artist metadata — song-only' }
	}

	let bestArtist = 0.0
	const rawRetStr = retArtists.join(' ')

	for (const req of reqArtists) {
		for (const ret of retArtists) {
			bestArtist = Math.max(bestArtist, getSimilarityRatio(req, ret))
		}
		if (retArtists.some((ret) => getSimilarityRatio(req, ret) >= artistThresh)) {
			return { found: true, bestArtist, method: 'Direct similarity' }
		}
		if (req.length >= 3 && rawRetStr.includes(req)) {
			return { found: true, bestArtist, method: 'Substring match' }
		}
		if (req.length >= 3 && retSong.includes(req)) {
			return { found: true, bestArtist, method: 'Featured in title' }
		}
		if (retArtists.some((r) => r.length >= 3 && normReqArtist.includes(r))) {
			return { found: true, bestArtist, method: 'Reversed collab' }
		}
		if (isExtension && bestArtist >= 0.2) {
			return { found: true, bestArtist, method: 'Extension collab accepted' }
		}
	}
	return { found: false, bestArtist, method: 'None' }
}

export function validateLyricsMatch(
	requestedArtist: string,
	requestedSong: string,
	result: Record<string, unknown>,
	threshold = 0.75,
): ValidationResult {
	const reqArtists = splitArtists(requestedArtist)
	const normReqSong = normalizeString(requestedSong)
	const [retArtists, retSong] = extractArtistSongFromResult(result)

	if (!retSong) {
		logger.warning(`No title in result — trusting fetcher for '${requestedSong}'`)
		return ok('No title metadata — trusting fetcher', 1.0, 1.0, retArtists, retSong, false)
	}

	const reqNonLatin = hasNonLatin(normReqSong)
	const retNonLatin = hasNonLatin(retSong)
	if (reqNonLatin !== retNonLatin) {
		logger.info(`Cross-script: '${requestedArtist}-${requestedSong}' → '${retArtists}-${retSong}'`)
		return ok('Cross-script match — similarity bypassed', 1.0, 1.0, retArtists, retSong, true)
	}

	const songThresh = adaptiveThreshold(requestedSong, threshold)
	const artistThresh = adaptiveThreshold(requestedArtist, threshold)
	const songSim = getSimilarityRatio(normReqSong, retSong)
	const isExtension = isExtensionSuffix(retSong, normReqSong)
	const songOk = songSim >= songThresh || isExtension

	const normReqArtist = normalizeString(requestedArtist)
	const { found, bestArtist, method } = findArtistMatch(
		reqArtists,
		retArtists,
		retSong,
		normReqArtist,
		artistThresh,
		isExtension,
	)

	if (found && songOk) {
		logger.info(
			`✓ ${method}: '${requestedArtist}'-'${requestedSong}' [a=${bestArtist.toFixed(2)} s=${songSim.toFixed(2)}]`,
		)
		return ok(`Matched via ${method}`, bestArtist, songSim, retArtists, retSong, false)
	}

	const rawRetStr = retArtists.join(' ')
	const parts: string[] = []
	if (!found) parts.push(`artist score=${bestArtist.toFixed(2)} < ${artistThresh.toFixed(2)}`)
	if (!songOk) parts.push(`song score=${songSim.toFixed(2)} < ${songThresh.toFixed(2)}`)
	const reason = parts.join(' | ')
	logger.warning(
		`✗ Rejected '${requestedArtist}-${requestedSong}' vs '${rawRetStr}-${retSong}': ${reason}`,
	)
	return {
		valid: false,
		reason,
		artist_match: Math.round(bestArtist * 1000) / 1000,
		song_match: Math.round(songSim * 1000) / 1000,
		returned_artists: retArtists,
		returned_song: retSong,
		script_mismatch: false,
	}
}
