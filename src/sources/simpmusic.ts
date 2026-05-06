import { httpGet } from '../lib/http'
import { buildResult, defineFetcher, parseLrc } from './base'

const API_BASE = 'https://api-lyrics.simpmusic.org/v1'

async function simpmusicSearch(
	artist: string,
	song: string,
	signal?: AbortSignal,
): Promise<{ videoId: unknown; artistName: unknown; title: unknown } | null> {
	const res = await httpGet(`${API_BASE}/search?q=${encodeURIComponent(`${song} ${artist}`)}`, {
		signal,
	})
	if (!res.ok) return null
	const data = (await res.json()) as unknown
	const results: unknown[] = Array.isArray(data)
		? data
		: (((data as Record<string, unknown>).data as unknown[]) ?? [])
	if (!results.length) return null
	const first = results[0] as Record<string, unknown>
	const videoId = first.videoId ?? first.id
	if (!videoId) return null
	return { videoId, artistName: first.artistName, title: first.title }
}

async function simpmusicGetLyrics(
	videoId: unknown,
	timestamps: boolean,
	signal?: AbortSignal,
): Promise<{ lyrics: string; synced: string | undefined } | null> {
	const res = await httpGet(`${API_BASE}/${videoId}`, { signal })
	if (!res.ok) return null
	const data = (await res.json()) as Record<string, unknown>
	let d = data.data
	if (Array.isArray(d)) d = d[0] ?? null
	if (!d || typeof d !== 'object') return null
	const dd = d as Record<string, unknown>
	const plain = (dd.plainLyrics ?? dd.lyrics) as string | undefined
	const synced = (dd.syncedLyrics ?? dd.lrc) as string | undefined
	const lyrics = timestamps && synced ? synced : plain
	if (!lyrics) return null
	return { lyrics, synced }
}

export const simpmusicFetcher = defineFetcher({
	source: 'simpmusic',
	displayName: 'SimpMusic',
	async run(artist, song, timestamps, signal) {
		const track = await simpmusicSearch(artist, song, signal)
		if (!track) return null

		const picked = await simpmusicGetLyrics(track.videoId, timestamps, signal)
		if (!picked) return null

		const timed = timestamps && picked.synced ? parseLrc(picked.synced) : undefined

		return buildResult({
			source: 'simpmusic',
			artist: (track.artistName as string | undefined) ?? artist,
			title: (track.title as string | undefined) ?? song,
			lyrics: picked.lyrics,
			timed_lyrics: timed,
			has_timestamps: Boolean(timed?.length),
		})
	},
})
