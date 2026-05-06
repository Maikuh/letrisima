import { Elysia } from 'elysia'
import { root } from '../lib/logger'

const logger = root.child({ name: 'http' })
const SKIP_LOG = new Set(['/favicon.ico', '/docs'])
const timings = new WeakMap<Request, number>()

const isPretty = process.env.NODE_ENV !== 'production'
const R = '\x1b[0m'

function statusColor(s: number) {
	if (s < 300) return '\x1b[32m'
	if (s < 400) return '\x1b[36m'
	if (s < 500) return '\x1b[33m'
	return '\x1b[31m'
}

function fmtHttpLog(method: string, path: string, status: number, ms: number) {
	if (!isPretty) return `${method} ${path} ${status} ${ms}ms`
	return `\x1b[35m${method}${R} ${path} ${statusColor(status)}${status}${R} \x1b[90m${ms}ms${R}`
}

export const httpLogger = new Elysia({ name: 'http-logger' })
	.onRequest(({ request }) => {
		timings.set(request, Date.now())
	})
	.onAfterHandle(({ request, set }) => {
		const url = new URL(request.url)
		if (SKIP_LOG.has(url.pathname)) return
		const path = url.pathname + url.search
		const status = typeof set.status === 'number' ? set.status : 200
		const ms = Date.now() - (timings.get(request) ?? Date.now())
		timings.delete(request)
		logger.info(fmtHttpLog(request.method, path, status, ms))
	})
	.as('scoped')
