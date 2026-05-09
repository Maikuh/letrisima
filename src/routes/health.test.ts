import { describe, expect, test } from 'bun:test'
import pkg from '../../package.json'
import { healthRoute } from './health'

describe('GET /health', () => {
	test('200 with expected shape', async () => {
		const res = await healthRoute.handle(new Request('http://localhost/health'))
		expect(res.status).toBe(200)
		const body = await res.json()
		expect(body.api).toBe('letrisima')
		expect(body.status).toBe('ok')
		expect(body.version).toBe(pkg.version)
		expect(body.docs).toContain('/docs')
		expect(typeof body.timestamp).toBe('string')
	})
})
