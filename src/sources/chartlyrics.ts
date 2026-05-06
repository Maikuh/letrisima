import { XMLParser } from 'fast-xml-parser'
import { httpGet } from '../lib/http'
import { buildResult, defineFetcher } from './base'

const BASE = 'http://api.chartlyrics.com/apiv1.asmx/SearchLyricDirect'
const parser = new XMLParser()

export const chartlyricsFetcher = defineFetcher({
	source: 'chartlyrics',
	displayName: 'ChartLyrics',
	async run(artist, song, _timestamps, signal) {
		const url = `${BASE}?artist=${encodeURIComponent(artist)}&song=${encodeURIComponent(song)}`
		const res = await httpGet(url, { signal })
		if (!res.ok) return null
		const text = await res.text()
		if (!text.includes('<Lyric>')) return null

		const parsed = parser.parse(text) as Record<string, unknown>
		const root = (parsed.GetLyricResult ?? parsed) as Record<string, unknown>
		const lyric = String(root.Lyric ?? '').trim()
		if (!lyric) return null

		return buildResult({
			source: 'chartlyrics',
			artist: String(root.LyricArtist ?? artist),
			title: String(root.LyricSong ?? song),
			lyrics: lyric,
		})
	},
})
