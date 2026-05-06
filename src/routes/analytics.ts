import { Elysia, t } from 'elysia'

import {
	AnalyticsStatus,
	QueryCount,
	TopQueriesResponse,
	TrendingByCountryResponse,
	TrendingIntersectionMatch,
	TrendingIntersectionResponse,
	TrendingSong,
	TrendingVsQueriesResponse,
} from '../lib/schemas'
import { getAnalyticsStatus, getTopQueries, getTopQueriesByCountry } from '../trending/analytics'
import { fetchTrending } from '../trending/fetch'

export const analyticsRoutes = new Elysia()
	.model({
		AnalyticsStatus,
		QueryCount,
		TopQueriesResponse,
		TrendingByCountryResponse,
		TrendingIntersectionMatch,
		TrendingIntersectionResponse,
		TrendingSong,
		TrendingVsQueriesResponse,
	})
	.get(
		'/analytics/top-queries/',
		({ query }) => {
			const limit = query.limit ?? 20
			const country = query.country?.toUpperCase()
			const days = query.days
			const results = getTopQueries(limit, country, days)
			return {
				limit,
				country: country ?? 'global',
				days: days ?? null,
				total: results.length,
				queries: results.map(([q, count]) => ({ query: q, count })),
			}
		},
		{
			query: t.Object({
				limit: t.Optional(
					t.Integer({ minimum: 1, maximum: 100, description: 'Number of results' }),
				),
				country: t.Optional(t.String({ description: 'Filter by country code' })),
				days: t.Optional(t.Integer({ minimum: 1, description: 'Time window in days' })),
			}),
			response: { 200: 'TopQueriesResponse' },
			detail: { summary: 'Top search queries', tags: ['Analytics'] },
		},
	)
	.get(
		'/analytics/trending-by-country/',
		({ query }) => {
			const limit = query.limit ?? 20
			const data = getTopQueriesByCountry(limit)
			const formatted: Record<string, Array<{ query: string; count: number }>> = {}
			for (const [country, pairs] of Object.entries(data)) {
				formatted[country] = pairs.map(([q, count]) => ({ query: q, count }))
			}
			return { limit, data: formatted }
		},
		{
			query: t.Object({
				limit: t.Optional(t.Integer({ minimum: 1, maximum: 100 })),
			}),
			response: { 200: 'TrendingByCountryResponse' },
			detail: { summary: 'Top queries grouped by country', tags: ['Analytics'] },
		},
	)
	.get(
		'/analytics/trending-vs-queries/',
		async ({ query }) => {
			const country = (query.country ?? 'US').toUpperCase()
			const limit = query.limit ?? 10
			const [songs, topQ] = await Promise.all([
				fetchTrending(country, limit),
				Promise.resolve(getTopQueries(limit, country)),
			])
			return {
				country,
				trending_songs: songs,
				top_user_queries: topQ.map(([q, count]) => ({ query: q, count })),
				trending_titles: songs.map((s) => `${s.title} - ${s.artist}`),
			}
		},
		{
			query: t.Object({
				country: t.Optional(t.String()),
				limit: t.Optional(t.Integer({ minimum: 1, maximum: 100 })),
			}),
			response: { 200: 'TrendingVsQueriesResponse' },
			detail: { summary: 'Compare trending songs with top user queries', tags: ['Analytics'] },
		},
	)
	.get(
		'/analytics/trending-intersection/',
		async ({ query }) => {
			const country = (query.country ?? 'US').toUpperCase()
			const limit = query.limit ?? 10
			const [songs, topQ] = await Promise.all([
				fetchTrending(country, limit * 2),
				Promise.resolve(getTopQueries(limit * 2, country)),
			])

			const keywords = new Map<string, (typeof songs)[0]>()
			for (const song of songs) {
				const tl = song.title.toLowerCase()
				const al = song.artist.toLowerCase()
				if (!keywords.has(tl)) keywords.set(tl, song)
				if (!keywords.has(al)) keywords.set(al, song)
				const combined = `${tl} ${al}`
				if (!keywords.has(combined)) keywords.set(combined, song)
			}

			const matches: Array<{
				query: string
				count: number
				matched_song: string
				matched_artist: string
				rank: number
			}> = []
			const seen = new Set<string>()

			for (const [q, count] of topQ) {
				if (seen.has(q)) continue
				for (const [kw, song] of keywords) {
					if (kw.includes(q) || q.includes(kw)) {
						matches.push({
							query: q,
							count,
							matched_song: song.title,
							matched_artist: song.artist,
							rank: song.rank,
						})
						seen.add(q)
						break
					}
				}
				if (matches.length >= limit) break
			}

			return { country, total: matches.length, matches }
		},
		{
			query: t.Object({
				country: t.Optional(t.String()),
				limit: t.Optional(t.Integer({ minimum: 1, maximum: 100 })),
			}),
			response: { 200: 'TrendingIntersectionResponse' },
			detail: { summary: 'Find user queries matching trending songs', tags: ['Analytics'] },
		},
	)
	.get(
		'/analytics/status',
		() => {
			return { ...getAnalyticsStatus() }
		},
		{
			response: { 200: 'AnalyticsStatus' },
			detail: { summary: 'Analytics engine status', tags: ['Analytics'] },
		},
	)
