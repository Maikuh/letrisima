import { beforeEach, describe, expect, test } from 'bun:test'
import { clearCache, saveToCache } from '../lib/cache'
import { cacheRoutes } from './cache'

beforeEach(() => clearCache())

describe('GET /cache/stats', () => {
	test('200 with stats shape', async () => {
		const res = await cacheRoutes.handle(new Request('http://localhost/cache/stats'))
		expect(res.status).toBe(200)
		const body = await res.json()
		expect(typeof body.cache_keys).toBe('number')
		expect(typeof body.ttl_seconds).toBe('number')
		expect(body.version).toBe('v2')
	})

	test('GET /admin/cache/stats also works', async () => {
		const res = await cacheRoutes.handle(new Request('http://localhost/admin/cache/stats'))
		expect(res.status).toBe(200)
	})

	test('cache_keys reflects actual store size', async () => {
		saveToCache('key1', { data: 'a' })
		saveToCache('key2', { data: 'b' })
		const res = await cacheRoutes.handle(new Request('http://localhost/cache/stats'))
		const body = await res.json()
		expect(body.cache_keys).toBe(2)
	})
})

describe('POST /admin/cache/clear', () => {
	test('no admin key configured → 403', async () => {
		const res = await cacheRoutes.handle(
			new Request('http://localhost/admin/cache/clear', { method: 'POST' }),
		)
		expect(res.status).toBe(403)
	})

	test('wrong key in header → 403', async () => {
		const res = await cacheRoutes.handle(
			new Request('http://localhost/admin/cache/clear', {
				method: 'POST',
				headers: { 'x-admin-key': 'wrongkey' },
			}),
		)
		expect(res.status).toBe(403)
	})

	test('wrong key in query → 403', async () => {
		const res = await cacheRoutes.handle(
			new Request('http://localhost/admin/cache/clear?key=wrongkey', { method: 'POST' }),
		)
		expect(res.status).toBe(403)
	})
})
