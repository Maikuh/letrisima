import { LRCLIB_API_BASE } from '../lib/config'
import { httpGet } from '../lib/http'
import { getLogger } from '../lib/logger'
import { type LyricResult, parseLrc } from './base'

const logger = getLogger('fetcher/lrclib')

const HTTP_OPTS = { timeoutMs: 15_000, retries: 2, retryDelayMs: 300 }

async function lrclibSearch(
	artist: string,
	song: string,
	signal?: AbortSignal,
): Promise<Record<string, unknown> | null> {
	const url = new URL('https://lrclib.net/api/search')
	url.searchParams.set('track_name', song)
	url.searchParams.set('artist_name', artist)
	const res = await httpGet(url.toString(), { ...HTTP_OPTS, signal })
	if (!res.ok) {
		logger.warning(`LRCLIB search returned ${res.status}`)
		return null
	}
	const results: unknown[] = await res.json()
	if (!Array.isArray(results) || !results.length) {
		logger.info('LRCLIB: no results found')
		return null
	}
	return results[0] as Record<string, unknown>
}

async function lrclibGet(
	track: Record<string, unknown>,
	signal?: AbortSignal,
): Promise<Record<string, unknown> | null> {
	const url = new URL(`${LRCLIB_API_BASE}/get`)
	if (track.trackName) url.searchParams.set('track_name', String(track.trackName))
	if (track.artistName) url.searchParams.set('artist_name', String(track.artistName))
	if (track.albumName) url.searchParams.set('album_name', String(track.albumName))
	if (track.duration) url.searchParams.set('duration', String(track.duration))
	const res = await httpGet(url.toString(), { ...HTTP_OPTS, signal })
	if (!res.ok) {
		logger.warning(`LRCLIB get returned ${res.status}`)
		return null
	}
	return (await res.json()) as Record<string, unknown>
}

function pickLyrics(
	data: Record<string, unknown>,
	timestamps: boolean,
): { lyrics: string; synced: string | undefined } | null {
	const synced = data.syncedLyrics as string | undefined
	const plain = data.plainLyrics as string | undefined
	const lyrics = timestamps && synced ? synced : (plain ?? null)
	if (!lyrics) {
		logger.info('LRCLIB: no lyrics content in response')
		return null
	}
	return { lyrics, synced }
}

export const lrclibFetcher = {
	async fetch(
		artist: string,
		song: string,
		timestamps: boolean,
		signal?: AbortSignal,
	): Promise<LyricResult | null> {
		try {
			logger.info(`LRCLIB: fetching '${artist} – ${song}' (timestamps=${timestamps})`)

			const track = await lrclibSearch(artist, song, signal)
			if (!track) return null

			const data = await lrclibGet(track, signal)
			if (!data) return null

			const picked = pickLyrics(data, timestamps)
			if (!picked) return null
			const { lyrics, synced } = picked

			const durationMs = data.duration ? Number(data.duration) * 1000 : undefined
			let timedLyrics: ReturnType<typeof parseLrc> | undefined
			let hasTimestamps = false

			if (timestamps && synced) {
				const parsed = parseLrc(synced, durationMs)
				if (parsed.length) {
					timedLyrics = parsed
					hasTimestamps = true
				}
			}

			logger.info(`LRCLIB: success (hasTimestamps=${hasTimestamps})`)
			return {
				source: 'lrclib',
				artist: String(data.artistName ?? artist),
				title: String(data.trackName ?? song),
				album: data.albumName,
				duration: data.duration,
				instrumental: Boolean(data.instrumental),
				lyrics,
				hasTimestamps,
				timestamp: new Date().toISOString().replace('T', ' ').slice(0, 19),
				...(timedLyrics ? { timed_lyrics: timedLyrics } : {}),
			}
		} catch (err) {
			logger.error(`LRCLIB error: ${err}`)
			return null
		}
	},
}
