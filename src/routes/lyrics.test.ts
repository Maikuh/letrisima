import { beforeEach, describe, expect, mock, test } from 'bun:test'
import { Elysia } from 'elysia'
import { cacheStats, clearCache, loadFromCache, makeCacheKey } from '../lib/cache'

// Hoisted by Bun test runner above static imports — intercepts lyrics.ts's import of ../fetcher
mock.module('../fetcher', () => ({
	fetchLyricsController: mock(async () => ({
		data: {
			source: 'lrclib',
			artist: 'Taylor Swift',
			title: 'Shake It Off',
			lyrics: 'Shake it off, shake it off',
			hasTimestamps: false,
			timestamp: '2024-01-01 00:00:00',
		},
	})),
}))

import { lyricsRoutes } from './lyrics'

const app = new Elysia()
	.onError(({ code, set }) => {
		if (code === 'VALIDATION') {
			set.status = 422
			return { status: 'error', error: { message: 'Validation error' } }
		}
	})
	.use(lyricsRoutes)

beforeEach(() => clearCache())

describe('GET /lyrics/ — validation', () => {
	test('missing artist → 422', async () => {
		const res = await app.handle(new Request('http://localhost/lyrics/?song=Shake+It+Off'))
		expect(res.status).toBe(422)
	})

	test('missing song → 422', async () => {
		const res = await app.handle(new Request('http://localhost/lyrics/?artist=Taylor+Swift'))
		expect(res.status).toBe(422)
	})

	test('missing both → 422', async () => {
		const res = await app.handle(new Request('http://localhost/lyrics/'))
		expect(res.status).toBe(422)
	})
})

describe('GET /lyrics/ — success (mocked fetcher)', () => {
	test('valid params → 200 with data', async () => {
		const res = await app.handle(
			new Request('http://localhost/lyrics/?artist=Taylor+Swift&song=Shake+It+Off'),
		)
		expect(res.status).toBe(200)
		const body = await res.json()
		expect(body.data).toBeDefined()
		expect(body.data.lyrics).toBeTruthy()
		expect(body.data.source).toBe('lrclib')
	})

	test('timestamps param accepted', async () => {
		const res = await app.handle(
			new Request('http://localhost/lyrics/?artist=Taylor+Swift&song=Shake+It+Off&timestamps=true'),
		)
		expect(res.status).toBe(200)
	})

	test('fast param accepted', async () => {
		const res = await app.handle(
			new Request('http://localhost/lyrics/?artist=Taylor+Swift&song=Shake+It+Off&fast=true'),
		)
		expect(res.status).toBe(200)
	})
})

describe('GET /lyrics/ — caching', () => {
	test('first request populates cache', async () => {
		expect(cacheStats().cache_keys).toBe(0)

		await app.handle(new Request('http://localhost/lyrics/?artist=Taylor+Swift&song=Shake+It+Off'))

		const key = await makeCacheKey({
			artist: 'Taylor Swift',
			song: 'Shake It Off',
			timestamps: false,
			sequence: null,
			fast: false,
			source: null,
		})
		const cached = loadFromCache(key)
		expect(cached).not.toBeNull()
		expect(cacheStats().cache_keys).toBe(1)
	})

	test('cached value matches first response', async () => {
		const url = 'http://localhost/lyrics/?artist=Taylor+Swift&song=Shake+It+Off'
		const firstBody = await app.handle(new Request(url)).then((r) => r.json())

		const key = await makeCacheKey({
			artist: 'Taylor Swift',
			song: 'Shake It Off',
			timestamps: false,
			sequence: null,
			fast: false,
			source: null,
		})
		const cached = loadFromCache(key) as typeof firstBody
		expect(cached).toEqual(firstBody)
	})

	test('second request returns cached value', async () => {
		const url = 'http://localhost/lyrics/?artist=Taylor+Swift&song=Shake+It+Off'
		const firstBody = await app.handle(new Request(url)).then((r) => r.json())
		const secondBody = await app.handle(new Request(url)).then((r) => r.json())
		expect(secondBody).toEqual(firstBody)
		// fetcher only called once — second hit served from cache
		expect(cacheStats().cache_keys).toBe(1)
	})

	test('different params → separate cache entries', async () => {
		await app.handle(new Request('http://localhost/lyrics/?artist=Taylor+Swift&song=Shake+It+Off'))
		await app.handle(new Request('http://localhost/lyrics/?artist=Adele&song=Hello'))
		expect(cacheStats().cache_keys).toBe(2)
	})

	test('timestamps=true uses separate cache key from timestamps=false', async () => {
		await app.handle(
			new Request(
				'http://localhost/lyrics/?artist=Taylor+Swift&song=Shake+It+Off&timestamps=false',
			),
		)
		await app.handle(
			new Request('http://localhost/lyrics/?artist=Taylor+Swift&song=Shake+It+Off&timestamps=true'),
		)
		expect(cacheStats().cache_keys).toBe(2)
	})
})
