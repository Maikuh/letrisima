import { httpGet } from '../lib/http'
import { buildResult, defineFetcher } from './base'

export const lyricsovhFetcher = defineFetcher({
	source: 'lyrics.ovh',
	displayName: 'Lyrics.ovh',
	async run(artist, song, _timestamps, signal) {
		const res = await httpGet(
			`https://api.lyrics.ovh/v1/${encodeURIComponent(artist)}/${encodeURIComponent(song)}`,
			{ signal },
		)
		if (!res.ok) return null
		const data = (await res.json()) as Record<string, unknown>
		const lyrics = String(data.lyrics ?? '').trim()
		if (!lyrics) return null
		return buildResult({ source: 'lyrics.ovh', artist, title: song, lyrics })
	},
})
