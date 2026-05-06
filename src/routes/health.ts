import { Elysia } from 'elysia'

import pkg from '../../package.json'
import { HealthResponse } from '../lib/schemas'

export const healthRoute = new Elysia().model({ HealthResponse }).get(
	'/health',
	({ request }) => ({
		api: 'letrisima',
		version: pkg.version,
		status: 'ok',
		docs: `${new URL(request.url).origin}/docs`,
		timestamp: new Date().toISOString(),
	}),
	{
		response: { 200: 'HealthResponse' },
		detail: { summary: 'Health check', tags: ['System'] },
	},
)
