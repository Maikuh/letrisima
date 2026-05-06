import { getLogger } from './lib/logger'
import { type ValidationResult, validateLyricsMatch } from './lib/validator'
import { ALL_FETCHERS } from './sources'
import type { LyricResult } from './sources/base'

const logger = getLogger('fetcher/fetch_controller')

const FETCHER_MAP: Record<number, [string, string]> = {
	1: ['Genius', 'genius'],
	2: ['LRCLIB', 'lrclib'],
	3: ['SimpMusic', 'simpmusic'],
	4: ['YouTube Music', 'youtube'],
	5: ['Lyrics.ovh', 'lyricsovh'],
	6: ['ChartLyrics', 'chartlyrics'],
	7: ['Letras', 'letras'],
}

const DEFAULT_SYNCED_SEQUENCE = [2, 3, 4, 5]
const DEFAULT_PLAIN_SEQUENCE = [1, 2, 3, 4, 5, 6, 7]
const FAST_MODE_SEQUENCE = [2, 3]

function ts(): string {
	return new Date().toISOString().replace('T', ' ').slice(0, 19)
}

function errResp(msg: string) {
	return { status: 'error', error: { message: msg, timestamp: ts() } }
}

interface Attempt {
	api: string
	success: boolean
	result?: LyricResult
	validation?: ValidationResult
	reason?: string
}

async function fetchWithTimeout(
	apiName: string,
	fetcherKey: string,
	artist: string,
	song: string,
	timestamps: boolean,
	timeoutMs = 35_000,
	signal?: AbortSignal,
): Promise<Attempt> {
	const fetcher = ALL_FETCHERS[fetcherKey]
	if (!fetcher) return { api: apiName, success: false, reason: 'not_configured' }

	try {
		const result = await Promise.race<LyricResult | null>([
			fetcher.fetch(artist, song, timestamps, signal),
			new Promise<null>((_, reject) => setTimeout(() => reject(new Error('timeout')), timeoutMs)),
		])
		if (result?.lyrics) return { api: apiName, success: true, result }
		return { api: apiName, success: false, reason: 'no_lyrics' }
	} catch (e) {
		if (signal?.aborted) return { api: apiName, success: false, reason: 'aborted' }
		const reason = e instanceof Error ? e.message : String(e)
		if (reason === 'timeout') logger.warning(`[${apiName}] timed out after ${timeoutMs / 1000}s`)
		else logger.error(`[${apiName}] error: ${reason}`)
		return { api: apiName, success: false, reason }
	}
}

/**
 * Parallel fetch with validate-before-cancel:
 * A failed validation does NOT cancel siblings — only a passing validation does.
 */
async function fetchParallel(
	artist: string,
	song: string,
	timestamps: boolean,
	fetcherIds: number[],
): Promise<[LyricResult | null, Attempt[]]> {
	const entries = fetcherIds
		.filter((id) => id in FETCHER_MAP)
		.map((id) => FETCHER_MAP[id] as [string, string])
		.filter(([, key]) => ALL_FETCHERS[key])

	if (!entries.length) return [null, []]

	const allAttempts: Attempt[] = []
	const controller = new AbortController()
	const { signal } = controller

	type Tagged = { task: Promise<Tagged>; attempt: Attempt }
	let pending: Promise<Tagged>[] = entries.map(([apiName, key]) => {
		const p: Promise<Tagged> = fetchWithTimeout(
			apiName,
			key,
			artist,
			song,
			timestamps,
			35_000,
			signal,
		).then((attempt) => ({ task: p, attempt }))
		return p
	})

	while (pending.length > 0) {
		const { task: resolved, attempt } = await Promise.race(pending)
		pending = pending.filter((p) => p !== resolved)

		if (attempt.reason === 'aborted') continue

		allAttempts.push(attempt)

		if (!attempt.success) {
			logger.debug(`  [${attempt.api}] skipped — ${attempt.reason}`)
			continue
		}

		const val = validateLyricsMatch(artist, song, attempt.result as Record<string, unknown>, 0.75)

		if (val.valid) {
			logger.info(
				`✓ [${attempt.api}] accepted (artist=${val.artist_match} song=${val.song_match} script_mismatch=${val.script_mismatch})`,
			)
			attempt.validation = val
			controller.abort()
			return [attempt.result as LyricResult, allAttempts]
		} else {
			logger.warning(
				`✗ [${attempt.api}] rejected: ${val.reason} — ${pending.length} fetcher(s) still running`,
			)
		}
	}

	logger.warning(`All fetchers exhausted — no valid result for '${artist} - ${song}'`)
	return [null, allAttempts]
}

function resolveSequence(
	fastMode: boolean,
	passParam: boolean,
	sequence: string | null,
	timestamps: boolean,
): { fetcherIds: number[]; useParallel: boolean } | { error: Record<string, unknown> } {
	if (fastMode) {
		return { fetcherIds: FAST_MODE_SEQUENCE, useParallel: true }
	}
	if (passParam && sequence) {
		const parsed = sequence
			.split(',')
			.map((x) => parseInt(x.trim(), 10))
			.filter((x) => !Number.isNaN(x))
		if (
			!parsed.length ||
			!parsed.every((x) => x >= 1 && x <= 7) ||
			parsed.length > 7 ||
			new Set(parsed).size !== parsed.length
		) {
			return { error: errResp('Invalid sequence: must be unique numbers between 1 and 7') }
		}
		return { fetcherIds: parsed, useParallel: parsed.length > 1 }
	}
	return {
		fetcherIds: timestamps ? DEFAULT_SYNCED_SEQUENCE : DEFAULT_PLAIN_SEQUENCE,
		useParallel: true,
	}
}

function buildParallelSuccess(result: LyricResult, attempts: Attempt[]): Record<string, unknown> {
	const response: Record<string, unknown> = { data: result }
	const match = attempts.find((a) => a.result === result && a.validation)
	if (match?.validation) {
		const v = match.validation
		if (v.artist_match < 1.0 || v.song_match < 1.0) {
			response.validation = {
				artist_match: v.artist_match,
				song_match: v.song_match,
				reason: v.reason,
				script_mismatch: v.script_mismatch,
			}
		}
	}
	return response
}

export async function fetchLyricsController(
	artistName: string,
	songTitle: string,
	timestamps = false,
	passParam = false,
	sequence: string | null = null,
	fastMode = false,
	source: string | null = null,
): Promise<Record<string, unknown>> {
	if (source) {
		const fetcher = ALL_FETCHERS[source]
		if (!fetcher)
			return errResp(`Unknown source '${source}'. Valid: ${Object.keys(ALL_FETCHERS).join(', ')}`)

		try {
			const raw = await Promise.race<LyricResult | null>([
				fetcher.fetch(artistName, songTitle, timestamps),
				new Promise<null>((_, reject) => setTimeout(() => reject(new Error('timeout')), 35_000)),
			])
			if (!raw?.lyrics)
				return errResp(`No lyrics found via '${source}' for '${songTitle}' by '${artistName}'`)
			return { data: raw }
		} catch (e) {
			return errResp(`Source '${source}' failed: ${e}`)
		}
	}

	const resolved = resolveSequence(fastMode, passParam, sequence, timestamps)
	if ('error' in resolved) return resolved.error
	const { fetcherIds, useParallel } = resolved

	if (useParallel) {
		const [result, attempts] = await fetchParallel(artistName, songTitle, timestamps, fetcherIds)
		if (result) return buildParallelSuccess(result, attempts)
		const sourcesWithResults = attempts.filter((a) => a.success).map((a) => a.api)
		if (sourcesWithResults.length) {
			return errResp(
				`Found results from ${sourcesWithResults.join(', ')} but none matched '${songTitle}' by '${artistName}'`,
			)
		}
		return errResp(`No lyrics found for '${songTitle}' by '${artistName}'`)
	}

	for (const fid of fetcherIds) {
		if (!(fid in FETCHER_MAP)) continue
		const [apiName, key] = FETCHER_MAP[fid] as [string, string]
		const fetcher = ALL_FETCHERS[key]
		if (!fetcher) {
			logger.warning(`[${apiName}] not configured`)
			continue
		}
		try {
			const raw = await Promise.race<LyricResult | null>([
				fetcher.fetch(artistName, songTitle, timestamps),
				new Promise<null>((_, reject) => setTimeout(() => reject(new Error('timeout')), 35_000)),
			])
			if (!raw?.lyrics) continue
			const val = validateLyricsMatch(artistName, songTitle, raw as Record<string, unknown>, 0.75)
			if (val.valid) {
				logger.info(`✓ [${apiName}] accepted (artist=${val.artist_match} song=${val.song_match})`)
				return { data: raw }
			} else {
				logger.warning(`✗ [${apiName}] rejected: ${val.reason} — trying next fetcher`)
			}
		} catch (e) {
			logger.error(`[${apiName}] exception: ${e}`)
		}
	}

	return errResp(`No lyrics found for '${songTitle}' by '${artistName}'`)
}
