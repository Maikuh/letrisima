import { describe, expect, test } from 'bun:test'
import { Elysia } from 'elysia'
import { timestamp } from '../lib/response'
import { routes } from './index'

const app = new Elysia()
	.onError(({ code, set }) => {
		if (code === 'NOT_FOUND') {
			set.status = 404
			return { status: 'error', error: { message: 'Endpoint not found', timestamp: timestamp() } }
		}
		if (code === 'VALIDATION') {
			set.status = 422
			return { status: 'error', error: { message: 'Validation error', timestamp: timestamp() } }
		}
	})
	.use(routes)

describe('404 — unknown routes', () => {
	test('unknown path → 404', async () => {
		const res = await app.handle(new Request('http://localhost/api/doesnotexist'))
		expect(res.status).toBe(404)
	})

	test('missing /api prefix → 404', async () => {
		const res = await app.handle(new Request('http://localhost/health'))
		expect(res.status).toBe(404)
	})

	test('root path → 404', async () => {
		const res = await app.handle(new Request('http://localhost/'))
		expect(res.status).toBe(404)
	})

	test('404 body shape', async () => {
		const res = await app.handle(new Request('http://localhost/api/nope'))
		const body = await res.json()
		expect(body.status).toBe('error')
		expect(body.error.message).toBe('Endpoint not found')
		expect(typeof body.error.timestamp).toBe('string')
	})
})

describe('404 — wrong method', () => {
	test('POST /api/health → 404', async () => {
		const res = await app.handle(new Request('http://localhost/api/health', { method: 'POST' }))
		expect(res.status).toBe(404)
	})

	test('DELETE /api/cache/stats → 404', async () => {
		const res = await app.handle(
			new Request('http://localhost/api/cache/stats', { method: 'DELETE' }),
		)
		expect(res.status).toBe(404)
	})
})

describe('known routes still reachable', () => {
	test('GET /api/health → 200', async () => {
		const res = await app.handle(new Request('http://localhost/api/health'))
		expect(res.status).toBe(200)
	})

	test('GET /api/cache/stats → 200', async () => {
		const res = await app.handle(new Request('http://localhost/api/cache/stats'))
		expect(res.status).toBe(200)
	})
})
