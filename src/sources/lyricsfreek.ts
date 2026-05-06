import * as cheerio from 'cheerio'
import { httpGet } from '../lib/http'
import { getLogger } from '../lib/logger'
import { buildResult, type LyricResult } from './base'

const logger = getLogger('fetcher/lyricsfreek')
const CLEANUP_RE = /\n*Submit Corrections.*/is

export const lyricsfreekFetcher = {
	async fetch(artist: string, song: string, _timestamps: boolean): Promise<LyricResult | null> {
		try {
			logger.info(`LyricsFreek: fetching '${artist} – ${song}'`)
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

			const res = await httpGet(url)
			if (!res.ok) return null
			const html = await res.text()

			const $ = cheerio.load(html)
			const el = $('div.lyrics').first() || $('div#lyrics').first() || $('.lyric-content').first()
			if (!el.length) return null

			const lyrics = el.text().replace(CLEANUP_RE, '').trim()
			if (!lyrics) return null

			return buildResult({ source: 'lyricsfreek', artist, title: song, lyrics })
		} catch (err) {
			logger.error(`LyricsFreek error: ${err}`)
			return null
		}
	},
}
