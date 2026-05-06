import { Elysia, t } from 'elysia'

import { httpGet } from '../lib/http'
import { getLogger } from '../lib/logger'
import { errBody } from '../lib/response'
import { ErrorResponse, SuggestionItem, SuggestionResponse } from '../lib/schemas'

const logger = getLogger('suggestions')

export const suggestionsRoute = new Elysia()
	.model({ SuggestionItem, SuggestionResponse, ErrorResponse })
	.get(
		'/suggestions',
		async ({ query, status }) => {
			const q = query.q.trim()
			if (!q) return status(400, errBody("Query parameter 'q' is required"))

			const limit = query.limit ?? 10

			try {
				const url = new URL('https://musicbrainz.org/ws/2/recording/')
				url.searchParams.set('query', q)
				url.searchParams.set('fmt', 'json')
				url.searchParams.set('limit', String(limit))
				const res = await httpGet(url.toString(), {
					headers: { 'User-Agent': 'letrisima/1.0 (https://github.com/letrisima)' },
					timeoutMs: 10_000,
				})
				if (!res.ok) throw new Error(`MusicBrainz returned ${res.status}`)
				const data = (await res.json()) as Record<string, unknown>
				const recordings = (data.recordings as unknown[] | undefined) ?? []

				const results = recordings.map((rec) => {
					const r = rec as Record<string, unknown>
					const title = String(r.title ?? '')
					const credits = (r['artist-credit'] as Array<Record<string, unknown>> | undefined) ?? []
					const artistParts: string[] = []
					for (const credit of credits) {
						if (typeof credit === 'object' && credit.artist) {
							artistParts.push(String((credit.artist as Record<string, unknown>).name ?? ''))
							artistParts.push(String(credit.joinphrase ?? ''))
						} else if (typeof credit === 'string') {
							artistParts.push(credit)
						}
					}
					const artist = artistParts.join('').trim() || 'Unknown Artist'
					return { title, artist }
				})

				return { query: q, limit, total: results.length, results }
			} catch (e) {
				logger.error(`Suggestions error: ${e}`)
				return status(500, errBody('Failed to fetch suggestions from MusicBrainz'))
			}
		},
		{
			query: t.Object({
				q: t.String({ description: 'Search query' }),
				limit: t.Optional(t.Integer({ minimum: 1, maximum: 100, description: 'Result limit' })),
			}),
			response: { 200: 'SuggestionResponse', 400: 'ErrorResponse', 500: 'ErrorResponse' },
			detail: { summary: 'Search songs on MusicBrainz', tags: ['Suggestions'] },
		},
	)
