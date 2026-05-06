import { Elysia, t } from 'elysia'
import { errBody } from '../lib/response'
import {
	ErrorResponse,
	TrendingByCountriesResponse,
	TrendingResponse,
	TrendingSong,
} from '../lib/schemas'
import { fetchTrending, fetchTrendingByCountries } from '../trending/fetch'

const SUPPORTED_COUNTRIES = ['US', 'GB', 'IN', 'BR', 'JP', 'DE', 'FR', 'CA', 'AU', 'MX']

export const trendingRoute = new Elysia()
	.model({ TrendingSong, TrendingResponse, TrendingByCountriesResponse, ErrorResponse })
	.get(
		'/trending/',
		async ({ query, status }) => {
			const limit = Math.min(Math.max(query.limit ?? 20, 1), 200)

			if (query.countries) {
				const countries = query.countries
					.split(',')
					.map((c) => c.trim().toUpperCase())
					.filter((c) => SUPPORTED_COUNTRIES.includes(c))
				if (countries.length === 0) return status(400, errBody('No valid country codes provided'))
				const data = await fetchTrendingByCountries(countries, limit)
				return { countries: data, total_countries: Object.keys(data).length }
			}

			const country = (query.country ?? 'US').toUpperCase()
			if (!SUPPORTED_COUNTRIES.includes(country)) {
				return status(
					400,
					errBody(`Unsupported country: ${country}. Supported: ${SUPPORTED_COUNTRIES.join(', ')}`),
				)
			}
			const songs = await fetchTrending(country, limit)
			return { country, trending: songs, total: songs.length }
		},
		{
			query: t.Object({
				country: t.Optional(t.String({ description: 'ISO 3166-1 alpha-2 country code' })),
				countries: t.Optional(t.String({ description: 'Comma-separated country codes' })),
				limit: t.Optional(
					t.Integer({ minimum: 1, maximum: 200, description: 'Songs per country' }),
				),
			}),
			response: {
				200: t.Union([TrendingResponse, TrendingByCountriesResponse]),
				400: ErrorResponse,
			},
			detail: { summary: 'Get trending songs by country', tags: ['Trending'] },
		},
	)
