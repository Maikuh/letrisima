import { Elysia } from 'elysia'
import { analyticsRoutes } from './analytics'
import { cacheRoutes } from './cache'
import { healthRoute } from './health'
import { lyricsRoutes } from './lyrics'
import { suggestionsRoute } from './suggestions'
import { trendingRoute } from './trending'

export const routes = new Elysia({ prefix: '/api' })
	.use(healthRoute)
	.use(lyricsRoutes)
	.use(trendingRoute)
	.use(analyticsRoutes)
	.use(suggestionsRoute)
	.use(cacheRoutes)
