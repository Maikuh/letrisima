import * as cheerio from 'cheerio'
import { httpGet } from '../lib/http'
import { getLogger } from '../lib/logger'
import { buildResult, type LyricResult } from './base'

const logger = getLogger('fetcher/letras')

function deburr(str: string): string {
	return str.normalize('NFD').replace(/[̀-ͯ]/g, '')
}

function kebabCase(str: string): string {
	return str
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, '-')
		.replace(/^-|-$/g, '')
}

export const letrasFetcher = {
	async fetch(
		artist: string,
		song: string,
		_timestamps: boolean,
		signal?: AbortSignal,
	): Promise<LyricResult | null> {
		try {
			const artistSlug = kebabCase(deburr(artist.trim()))
			const songSlug = kebabCase(deburr(song.trim()))
			const url = `https://www.letras.com/${artistSlug}/${songSlug}/`

			logger.info(`Letras: fetching '${artist} – ${song}'`)

			const res = await httpGet(url, { timeoutMs: 15_000, signal })
			if (!res.ok || res.redirected) return null

			const html = await res.text()
			const $ = cheerio.load(html)

			const el = $('.lyric-original p, .lyric-tra p')
			if (el.length === 0) return null

			let lyrics = ''
			el.each((_, p) => {
				const $p = $(p)
				$p.find('br').replaceWith('\n')
				lyrics += `${$p.text().trim()}\n\n`
			})

			lyrics = lyrics.trim()
			if (!lyrics) return null

			const resultArtist = $('.title-secondary h2').text().trim() || artist
			const resultTitle = $('.title-primary h1').text().trim() || song

			return buildResult({ source: 'letras', artist: resultArtist, title: resultTitle, lyrics })
		} catch (err) {
			logger.error(`Letras error: ${err}`)
			return null
		}
	},
}
