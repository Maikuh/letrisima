import { httpGet } from '../lib/http'
import { getLogger } from '../lib/logger'
import { buildResult, type LyricResult } from './base'

const logger = getLogger('fetcher/lyricsovh')

export const lyricsovhFetcher = {
	async fetch(
		artist: string,
		song: string,
		_timestamps: boolean,
		signal?: AbortSignal,
	): Promise<LyricResult | null> {
		try {
			logger.info(`Lyrics.ovh: fetching '${artist} – ${song}'`)
			const res = await httpGet(
				`https://api.lyrics.ovh/v1/${encodeURIComponent(artist)}/${encodeURIComponent(song)}`,
				{ signal },
			)
			if (!res.ok) return null
			const data = (await res.json()) as Record<string, unknown>
			const lyrics = String(data.lyrics ?? '').trim()
			if (!lyrics) return null
			return buildResult({ source: 'lyrics.ovh', artist, title: song, lyrics })
		} catch (err) {
			logger.error(`Lyrics.ovh error: ${err}`)
			return null
		}
	},
}
