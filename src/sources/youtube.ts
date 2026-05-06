import YTMusic from 'ytmusic-api'
import { getLogger } from '../lib/logger'
import { buildResult, type LyricResult } from './base'

const logger = getLogger('fetcher/youtube')

let ytmusic: YTMusic | null = null
let initializing = false
let initPromise: Promise<void> | null = null

async function getYTMusic(): Promise<YTMusic | null> {
	if (ytmusic) return ytmusic
	if (initializing && initPromise) {
		await initPromise
		return ytmusic
	}
	initializing = true
	initPromise = (async () => {
		try {
			const instance = new YTMusic()
			await instance.initialize()
			ytmusic = instance
			logger.info('YTMusic instance created')
		} catch (err) {
			logger.error(`Failed to create YTMusic instance: ${err}`)
		}
	})()
	await initPromise
	return ytmusic
}

export const youtubeFetcher = {
	async fetch(
		artist: string,
		song: string,
		_timestamps: boolean,
		_signal?: AbortSignal,
	): Promise<LyricResult | null> {
		try {
			logger.info(`YouTube Music: fetching '${artist} – ${song}'`)
			const yt = await getYTMusic()
			if (!yt) return null

			const results = await yt.searchSongs(`${song} ${artist}`)
			if (!results.length) return null

			const artistLower = artist.toLowerCase()
			let videoId: string | null = null
			for (const r of results) {
				const rArtist = (r.artist?.name ?? '').toLowerCase()
				if (rArtist.includes(artistLower)) {
					videoId = r.videoId
					break
				}
			}
			if (!videoId) videoId = results[0]?.videoId ?? null
			if (!videoId) return null

			const lyricsLines = await yt.getLyrics(videoId)
			if (!lyricsLines) return null

			const lyrics = lyricsLines.join('\n')
			if (!lyrics.trim()) return null

			return buildResult({
				source: 'youtube_music',
				artist,
				title: song,
				lyrics,
				has_timestamps: false,
			})
		} catch (err) {
			logger.error(`YouTube Music error: ${err}`)
			return null
		}
	},
}
