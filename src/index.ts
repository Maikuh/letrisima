import { cors } from '@elysia/cors'
import { openapi } from '@elysia/openapi'
import { Elysia } from 'elysia'
import { rateLimit } from 'elysia-rate-limit'
import pkg from '../package.json'
import { PORT } from './lib/config'
import { getLogger } from './lib/logger'
import { timestamp } from './lib/response'
import { httpLogger } from './plugins/http-logger'
import { routes } from './routes'

const app = new Elysia()
	.get('/favicon.ico', ({ set }) => {
		set.status = 204
		return ''
	})
	.use(httpLogger)
	.use(
		openapi({
			path: '/docs',
			documentation: {
				info: {
					title: 'Letrisima',
					version: pkg.version,
					description: 'Multi-source lyrics API with trending and analytics.',
					license: {
						name: 'GNU GPLv3',
						url: 'https://github.com/Maikuh/letrisima/blob/main/LICENSE',
					},
				},
				tags: [
					{ name: 'Lyrics', description: 'Fetch lyrics' },
					{ name: 'Trending', description: 'Trending songs by country' },
					{ name: 'Analytics', description: 'Search query analytics' },
					{ name: 'Suggestions', description: 'Song search suggestions via MusicBrainz' },
					{ name: 'Cache', description: 'Cache management (admin)' },
					{ name: 'System', description: 'Health and system info' },
				],
			},
			scalar: {
				darkMode: true,
				defaultOpenAllTags: true,
				telemetry: false,
			},
		}),
	)
	.use(cors())
	.use(
		rateLimit({
			max: 15,
			duration: 60_000,
			errorResponse: JSON.stringify({
				status: 'error',
				error: { message: 'Too many requests', timestamp: timestamp() },
			}),
		}),
	)
	.onError(({ code, error, set }) => {
		if (code === 'NOT_FOUND') {
			set.status = 404
			return { status: 'error', error: { message: 'Endpoint not found', timestamp: timestamp() } }
		}
		if (code === 'VALIDATION') {
			set.status = 422
			return {
				status: 'error',
				error: {
					message: 'Validation error',
					details: typeof error === 'object' && error !== null ? error.value.error : String(error),
					timestamp: timestamp(),
				},
			}
		}
		set.status = 500
		return { status: 'error', error: { message: 'Internal server error', timestamp: timestamp() } }
	})
	.use(routes)
	.listen({ port: PORT, idleTimeout: 60 })

const logger = getLogger('app')
logger.info(`letrisima API running at http://${app.server?.hostname}:${app.server?.port}/api`)
logger.info(`OpenAPI docs at http://${app.server?.hostname}:${app.server?.port}/docs`)
