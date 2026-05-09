import { config } from '../lib/config'
import { httpGet } from '../lib/http'
import { getLogger } from '../lib/logger'
import { buildResult, defineFetcher, type LyricResult, parseLrc, type TimedLine } from './base'

const logger = getLogger('fetcher/mxm')

const BASE = 'https://apic-desktop.musixmatch.com/ws/1.1'
const APP_ID = 'web-desktop-app-v1.0'
const TOKEN_TTL_MS = 9 * 60_000

const MXM_HEADERS = {
	Accept: 'application/json, text/plain, */*',
	'Sec-Fetch-Dest': 'empty',
	'Sec-Fetch-Mode': 'cors',
	'Sec-Fetch-Site': 'same-site',
}

type HeadersWithCookies = Headers & { getSetCookie?: () => string[] }

interface TokenState {
	token: string
	cookie: string
	expires: number
}

let tokenState: TokenState | null = null
let tokenPromise: Promise<TokenState> | null = null

async function fetchToken(signal?: AbortSignal): Promise<TokenState> {
	const res = await httpGet(`${BASE}/token.get?app_id=${APP_ID}`, {
		headers: MXM_HEADERS,
		signal,
		timeoutMs: 10_000,
	})
	if (!res.ok) throw new Error(`token.get HTTP ${res.status}`)

	const data = (await res.json()) as Record<string, unknown>
	const msg = (data.message as Record<string, unknown>) ?? {}
	const hdr = (msg.header as Record<string, unknown>) ?? {}
	if (hdr.status_code !== 200) throw new Error(`token.get status_code ${hdr.status_code}`)

	const token = String(((msg.body as Record<string, unknown>)?.user_token as string) ?? '')
	if (!token) throw new Error('MXM user_token missing from response')

	const rawCookies = (res.headers as HeadersWithCookies).getSetCookie?.() ?? []
	const cookie = rawCookies.map((c) => c.split(';')[0]).join('; ')

	return { token, cookie, expires: Date.now() + TOKEN_TTL_MS }
}

async function getToken(signal?: AbortSignal): Promise<TokenState> {
	if (tokenState && Date.now() < tokenState.expires) return tokenState
	if (!tokenPromise) {
		tokenPromise = fetchToken(signal).then(
			(s) => {
				tokenState = s
				tokenPromise = null
				return s
			},
			(e) => {
				tokenPromise = null
				throw e
			},
		)
	}
	return tokenPromise
}

async function mxmGet(
	path: string,
	params: Record<string, string>,
	state: TokenState,
	signal?: AbortSignal,
): Promise<Record<string, unknown> | null> {
	const qs = new URLSearchParams({ app_id: APP_ID, usertoken: state.token, ...params }).toString()
	const res = await httpGet(`${BASE}/${path}?${qs}`, {
		headers: { ...MXM_HEADERS, Cookie: state.cookie },
		signal,
	})
	if (!res.ok) {
		logger.warning(`MXM ${path} HTTP ${res.status}`)
		return null
	}
	const data = (await res.json()) as Record<string, unknown>
	const msg = (data.message as Record<string, unknown>) ?? {}
	const statusCode = (msg.header as Record<string, unknown>)?.status_code
	if (statusCode !== 200) {
		logger.warning(`MXM ${path} status_code ${statusCode}`)
		return null
	}
	return (msg.body as Record<string, unknown>) ?? null
}

function mxmSubtitleToLrc(subtitleBody: string): string | null {
	try {
		const items = JSON.parse(subtitleBody) as Array<{ text: string; time: { total: number } }>
		return items
			.map(({ text, time }) => {
				const min = Math.floor(time.total / 60)
				const sec = time.total % 60
				return `[${String(min).padStart(2, '0')}:${sec.toFixed(2).padStart(5, '0')}]${text}`
			})
			.join('\n')
	} catch {
		return null
	}
}

interface MacroResult {
	track: Record<string, unknown>
	lyricsBody: string | null
	subtitleBody: string | null
}

async function getMacroSubtitles(
	artist: string,
	song: string,
	state: TokenState,
	signal?: AbortSignal,
): Promise<MacroResult | null> {
	const body = await mxmGet(
		'macro.subtitles.get',
		{
			format: 'json',
			namespace: 'lyrics_richsynched',
			subtitle_format: 'mxm',
			q_artist: artist,
			q_track: song,
		},
		state,
		signal,
	)
	if (!body) return null

	const calls = (body.macro_calls as Record<string, unknown>) ?? {}

	const lyricsCall = (calls['track.lyrics.get'] as Record<string, unknown>) ?? {}
	const lyricsMsg = (lyricsCall.message as Record<string, unknown>) ?? {}
	const lyricsData =
		((lyricsMsg.body as Record<string, unknown>)?.lyrics as Record<string, unknown>) ?? {}

	if (lyricsData.instrumental === 1 || lyricsData.restricted === 1) return null

	const lyricsBody = (lyricsData.lyrics_body as string) || null

	const trackCall = (calls['matcher.track.get'] as Record<string, unknown>) ?? {}
	const trackMsg = (trackCall.message as Record<string, unknown>) ?? {}
	const track = ((trackMsg.body as Record<string, unknown>)?.track as Record<string, unknown>) ?? {}

	const subsCall = (calls['track.subtitles.get'] as Record<string, unknown>) ?? {}
	const subsMsg = (subsCall.message as Record<string, unknown>) ?? {}
	const subList = ((subsMsg.body as Record<string, unknown>)?.subtitle_list as unknown[]) ?? []
	const subtitleBody =
		(((subList[0] as Record<string, unknown>)?.subtitle as Record<string, unknown>)
			?.subtitle_body as string) || null

	if (!lyricsBody && !subtitleBody) return null

	return { track, lyricsBody, subtitleBody }
}

async function searchTrack(
	query: string,
	state: TokenState,
	signal?: AbortSignal,
): Promise<Record<string, unknown> | null> {
	const body = await mxmGet(
		'track.search',
		{ q_track: query, page_size: '3', page: '1', s_track_rating: 'desc' },
		state,
		signal,
	)
	if (!body) return null
	const list = (body.track_list as unknown[]) ?? []
	return ((list[0] as Record<string, unknown>)?.track as Record<string, unknown>) ?? null
}

async function getSubtitleByTrackId(
	trackId: string,
	state: TokenState,
	signal?: AbortSignal,
): Promise<string | null> {
	const body = await mxmGet(
		'track.subtitle.get',
		{ subtitle_format: 'lrc', track_id: trackId },
		state,
		signal,
	)
	if (!body) return null
	return ((body.subtitle as Record<string, unknown>)?.subtitle_body as string) || null
}

export const mxmFetcher = defineFetcher({
	source: 'mxm',
	displayName: 'Musixmatch',
	async run(artist, song, timestamps, signal): Promise<LyricResult | null> {
		if (!config.mxmEnabled) return null

		const state = await getToken(signal)

		// Prefer macro endpoint: single call returns track + lyrics + synced subtitles
		const macro = await getMacroSubtitles(artist, song, state, signal)
		if (macro) {
			const { track, lyricsBody, subtitleBody } = macro
			let timed: TimedLine[] | null = null
			if (timestamps && subtitleBody) {
				const lrc = mxmSubtitleToLrc(subtitleBody)
				if (lrc) timed = parseLrc(lrc)
			}
			const plain = lyricsBody ?? (timed ? timed.map((l) => l.text).join('\n') : null)
			if (!plain) return null
			return buildResult({
				source: 'mxm',
				artist: String(track.artist_name ?? artist),
				title: String(track.track_name ?? song),
				lyrics: plain,
				...(timed ? { timed_lyrics: timed } : {}),
			})
		}

		// Fallback: search then fetch by track ID (subtitle endpoint returns native LRC)
		const track = await searchTrack(`${artist} ${song}`, state, signal)
		if (!track?.track_id) return null

		const lrcText = await getSubtitleByTrackId(String(track.track_id), state, signal)
		if (!lrcText) return null

		const allLines = parseLrc(lrcText)
		if (!allLines.length) return null

		return buildResult({
			source: 'mxm',
			artist: String(track.artist_name ?? artist),
			title: String(track.track_name ?? song),
			lyrics: allLines.map((l) => l.text).join('\n'),
			...(timestamps ? { timed_lyrics: allLines } : {}),
		})
	},
})
