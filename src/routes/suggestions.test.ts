import { describe, expect, mock, test } from 'bun:test'
import { Elysia } from 'elysia'

const mockHttpGet = mock(async () => ({
	ok: true,
	status: 200,
	json: async () => ({
		recordings: [
			{
				title: 'Shake It Off',
				'artist-credit': [{ artist: { name: 'Taylor Swift' }, joinphrase: '' }],
			},
			{
				title: 'Blank Space',
				'artist-credit': [{ artist: { name: 'Taylor Swift' }, joinphrase: '' }],
			},
		],
	}),
}))

mock.module('../lib/http', () => ({ httpGet: mockHttpGet }))

import { suggestionsRoute } from './suggestions'

const app = new Elysia()
	.onError(({ code, set }) => {
		if (code === 'VALIDATION') {
			set.status = 422
			return { status: 'error', error: { message: 'Validation error' } }
		}
	})
	.use(suggestionsRoute)

describe('GET /suggestions — validation', () => {
	test('missing q → 422', async () => {
		const res = await app.handle(new Request('http://localhost/suggestions'))
		expect(res.status).toBe(422)
	})

	test('empty q → 400', async () => {
		const res = await app.handle(new Request('http://localhost/suggestions?q='))
		expect(res.status).toBe(400)
	})

	test('whitespace-only q → 400', async () => {
		const res = await app.handle(new Request('http://localhost/suggestions?q=+++'))
		expect(res.status).toBe(400)
	})
})

describe('GET /suggestions — success (mocked httpGet)', () => {
	test('valid q → 200 with results', async () => {
		const res = await app.handle(new Request('http://localhost/suggestions?q=taylor+swift'))
		expect(res.status).toBe(200)
		const body = await res.json()
		expect(body.query).toBe('taylor swift')
		expect(Array.isArray(body.results)).toBe(true)
		expect(body.total).toBe(2)
	})

	test('result shape correct', async () => {
		const res = await app.handle(new Request('http://localhost/suggestions?q=taylor+swift'))
		const body = await res.json()
		const item = body.results[0]
		expect(typeof item.title).toBe('string')
		expect(typeof item.artist).toBe('string')
	})

	test('limit param reflected in response', async () => {
		const res = await app.handle(new Request('http://localhost/suggestions?q=taylor+swift&limit=5'))
		const body = await res.json()
		expect(body.limit).toBe(5)
	})
})

describe('GET /suggestions — upstream error (mocked httpGet)', () => {
	test('httpGet not ok → 500', async () => {
		mockHttpGet.mockImplementationOnce(async () => ({
			ok: false,
			status: 503,
			json: async () => ({}),
		}))
		const res = await app.handle(new Request('http://localhost/suggestions?q=taylor+swift'))
		expect(res.status).toBe(500)
	})
})
