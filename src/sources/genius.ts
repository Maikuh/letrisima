import * as cheerio from 'cheerio'
import { config } from '../lib/config'
import { httpGet } from '../lib/http'
import { getLogger } from '../lib/logger'
import { buildResult, defineFetcher, type LyricResult } from './base'

const logger = getLogger('fetcher/genius')

const CONTRIBUTOR_RE = /^\d+\s+Contributors?.*?Lyrics\n/s
const EMBED_RE = /\d*\s*Embed\s*$/i

function cleanLyrics(raw: string): string {
	return raw.replace(CONTRIBUTOR_RE, '').replace(EMBED_RE, '').trim()
}

export const geniusFetcher = defineFetcher({
	source: 'genius',
	displayName: 'Genius',
	async run(artist, song, _timestamps, signal): Promise<LyricResult | null> {
		if (!config.geniusToken) {
			logger.info('Genius token not configured — skipping')
			return null
		}

		const searchRes = await httpGet(
			`https://api.genius.com/search?q=${encodeURIComponent(`${song} ${artist}`)}`,
			{ headers: { Authorization: `Bearer ${config.geniusToken}` }, signal },
		)
		if (!searchRes.ok) return null

		const searchData = (await searchRes.json()) as Record<string, unknown>
		const hits = ((searchData.response as Record<string, unknown>)?.hits as unknown[]) ?? []
		if (!hits.length) return null

		const hit = hits[0] as Record<string, unknown>
		const hitResult = hit.result as Record<string, unknown>
		const url = String(hitResult?.url ?? '')
		if (!url) return null

		const pageRes = await httpGet(url, { timeoutMs: 15_000, signal })
		if (!pageRes.ok) return null
		const html = await pageRes.text()

		const $ = cheerio.load(html)
		const parts: string[] = []
		$('[data-lyrics-container]').each((_, el) => {
			const $el = $(el)
			$el.find('br').replaceWith('\n')
			parts.push($el.text())
		})

		const raw = parts.join('\n\n')
		const lyrics = cleanLyrics(raw)
		if (!lyrics) return null

		const resultArtist = String(
			(hitResult.primary_artist as Record<string, unknown>)?.name ?? artist,
		)
		const resultTitle = String(hitResult.title ?? song)

		return buildResult({ source: 'genius', artist: resultArtist, title: resultTitle, lyrics })
	},
})
