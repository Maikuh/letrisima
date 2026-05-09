import { beforeEach, describe, expect, test } from 'bun:test'
import { cacheStats, clearCache, loadFromCache, makeCacheKey, saveToCache } from './cache'

const baseParams = {
	artist: 'Taylor Swift',
	song: 'Shake It Off',
	timestamps: false,
	sequence: null,
	fast: false,
	source: null,
}

beforeEach(() => {
	clearCache()
})

describe('makeCacheKey', () => {
	test('same params → same key', async () => {
		const a = await makeCacheKey(baseParams)
		const b = await makeCacheKey(baseParams)
		expect(a).toBe(b)
	})

	test('different artist → different key', async () => {
		const a = await makeCacheKey(baseParams)
		const b = await makeCacheKey({ ...baseParams, artist: 'Ed Sheeran' })
		expect(a).not.toBe(b)
	})

	test('different song → different key', async () => {
		const a = await makeCacheKey(baseParams)
		const b = await makeCacheKey({ ...baseParams, song: 'Blank Space' })
		expect(a).not.toBe(b)
	})

	test('artist case-insensitive (normalised to lower)', async () => {
		const a = await makeCacheKey({ ...baseParams, artist: 'taylor swift' })
		const b = await makeCacheKey({ ...baseParams, artist: 'TAYLOR SWIFT' })
		expect(a).toBe(b)
	})

	test('timestamps flag changes key', async () => {
		const a = await makeCacheKey({ ...baseParams, timestamps: false })
		const b = await makeCacheKey({ ...baseParams, timestamps: true })
		expect(a).not.toBe(b)
	})

	test('fast flag changes key', async () => {
		const a = await makeCacheKey({ ...baseParams, fast: false })
		const b = await makeCacheKey({ ...baseParams, fast: true })
		expect(a).not.toBe(b)
	})

	test('returns 64-char hex SHA-256', async () => {
		const key = await makeCacheKey(baseParams)
		expect(key).toMatch(/^[0-9a-f]{64}$/)
	})
})

describe('saveToCache / loadFromCache', () => {
	test('save then load returns same value', async () => {
		const key = await makeCacheKey(baseParams)
		const payload = { data: { lyrics: 'test lyrics' } }
		saveToCache(key, payload)
		expect(loadFromCache(key)).toEqual(payload)
	})

	test('missing key returns null', async () => {
		expect(loadFromCache('nonexistent')).toBeNull()
	})

	test('overwrite updates value', async () => {
		const key = await makeCacheKey(baseParams)
		saveToCache(key, { v: 1 })
		saveToCache(key, { v: 2 })
		expect(loadFromCache(key)).toEqual({ v: 2 })
	})
})

describe('clearCache', () => {
	test('returns count of removed entries', async () => {
		const k1 = await makeCacheKey(baseParams)
		const k2 = await makeCacheKey({ ...baseParams, artist: 'Ed Sheeran' })
		saveToCache(k1, {})
		saveToCache(k2, {})
		const { removed } = clearCache()
		expect(removed).toBe(2)
	})

	test('after clear, load returns null', async () => {
		const key = await makeCacheKey(baseParams)
		saveToCache(key, { data: 'x' })
		clearCache()
		expect(loadFromCache(key)).toBeNull()
	})

	test('empty cache removed is 0', () => {
		const { removed } = clearCache()
		expect(removed).toBe(0)
	})
})

describe('cacheStats', () => {
	test('cache_keys reflects current size', async () => {
		expect(cacheStats().cache_keys).toBe(0)
		const key = await makeCacheKey(baseParams)
		saveToCache(key, {})
		expect(cacheStats().cache_keys).toBe(1)
	})

	test('version is v2', () => {
		expect(cacheStats().version).toBe('v2')
	})

	test('ttl_seconds is a positive number', () => {
		expect(cacheStats().ttl_seconds).toBeGreaterThan(0)
	})
})
