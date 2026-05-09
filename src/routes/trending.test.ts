import { describe, expect, mock, test } from 'bun:test'
import { Elysia } from 'elysia'

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

const mockFetchTrending = mock(async () => [mockSong])
const mockFetchTrendingByCountries = mock(async (countries: string[]) =>
	Object.fromEntries(countries.map((c) => [c, [mockSong]])),
)

mock.module('../trending/fetch', () => ({
	fetchTrending: mockFetchTrending,
	fetchTrendingByCountries: mockFetchTrendingByCountries,
}))

import { trendingRoute } from './trending'

const app = new Elysia()
	.onError(({ code, set }) => {
		if (code === 'VALIDATION') {
			set.status = 422
			return { status: 'error', error: { message: 'Validation error' } }
		}
	})
	.use(trendingRoute)

describe('GET /trending/ — validation', () => {
	test('unsupported country → 400', async () => {
		const res = await app.handle(new Request('http://localhost/trending/?country=XX'))
		expect(res.status).toBe(400)
		const body = await res.json()
		expect(body.error.message).toContain('Unsupported country')
	})

	test('all invalid country codes in countries param → 400', async () => {
		const res = await app.handle(new Request('http://localhost/trending/?countries=XX,YY,ZZ'))
		expect(res.status).toBe(400)
		const body = await res.json()
		expect(body.error.message).toContain('No valid country codes')
	})
})

describe('GET /trending/ — single country (mocked fetch)', () => {
	test('default → 200 for US', async () => {
		const res = await app.handle(new Request('http://localhost/trending/'))
		expect(res.status).toBe(200)
		const body = await res.json()
		expect(body.country).toBe('US')
		expect(Array.isArray(body.trending)).toBe(true)
		expect(typeof body.total).toBe('number')
	})

	test('explicit country → reflected in response', async () => {
		const res = await app.handle(new Request('http://localhost/trending/?country=GB'))
		expect(res.status).toBe(200)
		const body = await res.json()
		expect(body.country).toBe('GB')
	})

	test('song shape in response', async () => {
		const res = await app.handle(new Request('http://localhost/trending/'))
		const body = await res.json()
		const song = body.trending[0]
		expect(typeof song.title).toBe('string')
		expect(typeof song.artist).toBe('string')
		expect(typeof song.rank).toBe('number')
	})
})

describe('GET /trending/ — multiple countries (mocked fetch)', () => {
	test('valid countries param → 200 with per-country data', async () => {
		const res = await app.handle(new Request('http://localhost/trending/?countries=US,GB'))
		expect(res.status).toBe(200)
		const body = await res.json()
		expect(typeof body.total_countries).toBe('number')
		expect(typeof body.countries).toBe('object')
		expect(body.countries.US).toBeDefined()
		expect(body.countries.GB).toBeDefined()
	})

	test('invalid codes filtered out, valid ones returned', async () => {
		const res = await app.handle(new Request('http://localhost/trending/?countries=US,XX'))
		expect(res.status).toBe(200)
		const body = await res.json()
		expect(body.countries.US).toBeDefined()
		expect(body.countries.XX).toBeUndefined()
	})
})
