import { describe, expect, mock, test } from 'bun:test'
import { Elysia } from 'elysia'
import { recordUserQuery } from '../trending/analytics'

const mockSong = {
	song_id: '1',
	title: 'Blinding Lights',
	artist: 'The Weeknd',
	album: 'After Hours',
	rank: 1,
	thumbnail: null,
	duration_seconds: 200,
	explicit: false,
	genre: 'Pop',
	url: null,
	timestamp: '2024-01-01T00:00:00.000Z',
}

mock.module('../trending/fetch', () => ({
	fetchTrending: mock(async () => [mockSong]),
}))

import { analyticsRoutes } from './analytics'

const app = new Elysia()
	.onError(({ code, set }) => {
		if (code === 'VALIDATION') {
			set.status = 422
			return { status: 'error', error: { message: 'Validation error' } }
		}
	})
	.use(analyticsRoutes)

describe('GET /analytics/status', () => {
	test('200 with status shape', async () => {
		const res = await app.handle(new Request('http://localhost/analytics/status'))
		expect(res.status).toBe(200)
		const body = await res.json()
		expect(typeof body.total_recorded_queries).toBe('number')
		expect(typeof body.unique_global_queries).toBe('number')
		expect(typeof body.countries_with_queries).toBe('number')
	})
})

describe('GET /analytics/top-queries/', () => {
	test('200 with expected shape', async () => {
		const res = await app.handle(new Request('http://localhost/analytics/top-queries/'))
		expect(res.status).toBe(200)
		const body = await res.json()
		expect(typeof body.limit).toBe('number')
		expect(Array.isArray(body.queries)).toBe(true)
		expect(typeof body.total).toBe('number')
	})

	test('limit param reflected in response', async () => {
		const res = await app.handle(new Request('http://localhost/analytics/top-queries/?limit=5'))
		const body = await res.json()
		expect(body.limit).toBe(5)
	})

	test('country param reflected in response', async () => {
		const res = await app.handle(new Request('http://localhost/analytics/top-queries/?country=BR'))
		const body = await res.json()
		expect(body.country).toBe('BR')
	})

	test('global queries default to "global" country in response', async () => {
		const res = await app.handle(new Request('http://localhost/analytics/top-queries/'))
		const body = await res.json()
		expect(body.country).toBe('global')
	})

	test('limit above max → 422', async () => {
		const res = await app.handle(new Request('http://localhost/analytics/top-queries/?limit=101'))
		expect(res.status).toBe(422)
	})

	test('days below min → 422', async () => {
		const res = await app.handle(new Request('http://localhost/analytics/top-queries/?days=0'))
		expect(res.status).toBe(422)
	})

	test('recorded query appears in results', async () => {
		recordUserQuery('test-ip', 'unique-test-query-xyz', 'US')
		const res = await app.handle(new Request('http://localhost/analytics/top-queries/'))
		const body = await res.json()
		const found = body.queries.find(
			(q: { query: string; count: number }) => q.query === 'unique-test-query-xyz',
		)
		expect(found).toBeDefined()
		expect(found.count).toBe(1)
	})

	test('repeated queries increment count', async () => {
		recordUserQuery('ip1', 'repeated-query-abc', 'US')
		recordUserQuery('ip2', 'repeated-query-abc', 'US')
		const res = await app.handle(new Request('http://localhost/analytics/top-queries/'))
		const body = await res.json()
		const found = body.queries.find(
			(q: { query: string; count: number }) => q.query === 'repeated-query-abc',
		)
		expect(found).toBeDefined()
		expect(found.count).toBe(2)
	})

	test('country-filtered queries only appear for that country', async () => {
		recordUserQuery('ip', 'country-specific-query-de', 'DE')
		const res = await app.handle(new Request('http://localhost/analytics/top-queries/?country=DE'))
		const body = await res.json()
		const found = body.queries.find(
			(q: { query: string; count: number }) => q.query === 'country-specific-query-de',
		)
		expect(found).toBeDefined()
	})
})

describe('GET /analytics/trending-by-country/', () => {
	test('200 with expected shape', async () => {
		const res = await app.handle(new Request('http://localhost/analytics/trending-by-country/'))
		expect(res.status).toBe(200)
		const body = await res.json()
		expect(typeof body.limit).toBe('number')
		expect(typeof body.data).toBe('object')
	})

	test('limit param reflected in response', async () => {
		const res = await app.handle(
			new Request('http://localhost/analytics/trending-by-country/?limit=5'),
		)
		const body = await res.json()
		expect(body.limit).toBe(5)
	})
})

describe('GET /analytics/trending-vs-queries/ (mocked fetch)', () => {
	test('200 with expected shape', async () => {
		const res = await app.handle(new Request('http://localhost/analytics/trending-vs-queries/'))
		expect(res.status).toBe(200)
		const body = await res.json()
		expect(typeof body.country).toBe('string')
		expect(Array.isArray(body.trending_songs)).toBe(true)
		expect(Array.isArray(body.top_user_queries)).toBe(true)
		expect(Array.isArray(body.trending_titles)).toBe(true)
	})

	test('country param used', async () => {
		const res = await app.handle(
			new Request('http://localhost/analytics/trending-vs-queries/?country=GB'),
		)
		const body = await res.json()
		expect(body.country).toBe('GB')
	})
})

describe('GET /analytics/trending-intersection/ (mocked fetch)', () => {
	test('200 with expected shape', async () => {
		const res = await app.handle(new Request('http://localhost/analytics/trending-intersection/'))
		expect(res.status).toBe(200)
		const body = await res.json()
		expect(typeof body.country).toBe('string')
		expect(typeof body.total).toBe('number')
		expect(Array.isArray(body.matches)).toBe(true)
	})
})
