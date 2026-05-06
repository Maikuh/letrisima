import * as cheerio from 'cheerio'
import { httpGet } from '../lib/http'
import { buildResult, defineFetcher } from './base'

const CLEANUP_RE = /\n*Submit Corrections.*/is

export const lyricsfreekFetcher = defineFetcher({
	source: 'lyricsfreek',
	displayName: 'LyricsFreek',
	async run(artist, song, _timestamps, signal) {
		const slugArtist = artist
			.toLowerCase()
			.replace(/[^\w\s-]/g, '')
			.trim()
			.replace(/\s+/g, '-')
		const slugSong = song
			.toLowerCase()
			.replace(/[^\w\s-]/g, '')
			.trim()
			.replace(/\s+/g, '-')
		const url = `https://www.lyricsfreek.com/${slugArtist}/${slugSong}-lyrics`

		const res = await httpGet(url, { signal })
		if (!res.ok) return null
		const html = await res.text()

		const $ = cheerio.load(html)
		const el = $('div.lyrics').first() || $('div#lyrics').first() || $('.lyric-content').first()
		if (!el.length) return null

		const lyrics = el.text().replace(CLEANUP_RE, '').trim()
		if (!lyrics) return null

		return buildResult({ source: 'lyricsfreek', artist, title: song, lyrics })
	},
})
