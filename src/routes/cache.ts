import { timingSafeEqual } from 'node:crypto'

import { Elysia, t } from 'elysia'

import { cacheStats, clearCache } from '../lib/cache'
import { ADMIN_KEY } from '../lib/config'
import { getLogger } from '../lib/logger'
import { jsonError } from '../lib/response'
import { CacheStats } from '../lib/schemas'

const logger = getLogger('cache')

function checkAdmin(request: Request, queryKey?: string): boolean {
	if (!ADMIN_KEY) return false
	const provided = queryKey ?? request.headers.get('x-admin-key') ?? ''
	if (!provided) return false
	try {
		const a = Buffer.from(ADMIN_KEY.padEnd(64).slice(0, 64))
		const b = Buffer.from(provided.padEnd(64).slice(0, 64))
		return timingSafeEqual(a, b) && provided === ADMIN_KEY
	} catch {
		return false
	}
}

const statsHandler = () => {
	const stats = cacheStats()
	return { ...stats }
}

const clearHandler = (request: Request, queryKey?: string) => {
	if (!checkAdmin(request, queryKey)) {
		return jsonError('Unauthorized', 403)
	}
	const res = clearCache()
	logger.info('Cache cleared')
	return { details: res }
}

const keyQuery = t.Object({
	key: t.Optional(t.String({ description: 'Admin key (alternative to X-Admin-Key header)' })),
})

export const cacheRoutes = new Elysia()
	.model({ CacheStats })
	.get('/cache/stats', statsHandler, {
		response: { 200: 'CacheStats' },
		detail: { summary: 'Cache statistics', tags: ['Cache'] },
	})
	.get('/admin/cache/stats', statsHandler, {
		response: { 200: 'CacheStats' },
		detail: { summary: 'Cache statistics (admin path)', tags: ['Cache'], hide: true },
	})
	.post('/admin/cache/clear', ({ request, query }) => clearHandler(request, query.key), {
		query: keyQuery,
		detail: { summary: 'Clear cache — admin path', tags: ['Cache'], hide: true },
	})
