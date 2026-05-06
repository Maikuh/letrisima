import { Elysia, t } from 'elysia'
import { fetchLyricsController } from '../fetcher'
import { loadFromCache, makeCacheKey, saveToCache } from '../lib/cache'
import { getLogger } from '../lib/logger'
import { jsonError } from '../lib/response'
import { LyricData, LyricsResponse, TimedLine } from '../lib/schemas'
import { SOURCE_KEYS, type SourceKey } from '../sources'
import { recordUserQuery } from '../trending/analytics'

const logger = getLogger('lyrics')

type LyricsQuery = {
	artist: string
	song: string
	country?: string
	timestamps?: boolean
	timestamp?: boolean
	pass?: boolean
	sequence?: string
	fast?: boolean
	source?: SourceKey
}

// biome-ignore lint/suspicious/noExplicitAny: Elysia's type system cannot express Promise<Response | LyricsResponse>
async function handleLyricsRequest(query: LyricsQuery, request: Request): Promise<any> {
	const artist = query.artist.trim()
	const song = query.song.trim()

	if (!artist || !song) return jsonError('Artist and song name are required', 400)
	if (query.pass && !query.sequence)
		return jsonError('Sequence parameter is required when pass=true', 400)

	const country = (query.country ?? 'US').toUpperCase()
	const wantTimestamps = query.timestamps ?? query.timestamp ?? false
	const passParam = query.pass ?? false
	const sequence = query.sequence ?? null
	const fastMode = query.fast ?? false
	const source = query.source ?? null

	try {
		const ip = request.headers.get('x-forwarded-for') ?? 'unknown'
		recordUserQuery(ip, `${artist} - ${song}`, country)
	} catch {
		// analytics are non-fatal
	}

	const cacheKey = await makeCacheKey({
		artist,
		song,
		timestamps: wantTimestamps,
		sequence,
		fast: fastMode,
		source,
	})
	const cached = loadFromCache(cacheKey)
	if (cached) {
		logger.info(`Cache hit: ${artist} - ${song}`)
		return cached as Record<string, unknown>
	}

	let result: Record<string, unknown>
	try {
		result = await fetchLyricsController(
			artist,
			song,
			wantTimestamps,
			passParam,
			sequence,
			fastMode,
			source,
		)
	} catch (e) {
		logger.error(`Lyrics fetch error: ${e}`)
		return jsonError('Failed to fetch lyrics', 500, String(e))
	}

	const data = result.data as Record<string, unknown> | undefined
	if (data?.lyrics) saveToCache(cacheKey, result)

	return result
}

export const lyricsRoutes = new Elysia()
	.model({ TimedLine, LyricData, LyricsResponse })
	.get(
		'/lyrics/',
		({ query, request }) => handleLyricsRequest(query as unknown as LyricsQuery, request),
		{
			query: t.Object({
				artist: t.String({ description: 'Artist name' }),
				song: t.String({ description: 'Song title' }),
				country: t.Optional(t.String({ description: 'ISO 3166-1 alpha-2 country code' })),
				timestamps: t.Optional(t.Boolean({ description: 'Include synced timestamps' })),
				timestamp: t.Optional(t.Boolean({ description: 'Alias for timestamps' })),
				pass: t.Optional(t.Boolean({ description: 'Enable custom fetcher sequence' })),
				sequence: t.Optional(t.String({ description: 'Comma-separated fetcher IDs (1–7)' })),
				fast: t.Optional(t.Boolean({ description: 'Fast mode — fewer fetchers, parallel' })),
				source: t.Optional(
					t.String({
						enum: Object.values(SOURCE_KEYS),
						description: 'Use single source directly, skipping race',
					}),
				),
			}),
			response: { 200: 'LyricsResponse' },
			detail: { summary: 'Get lyrics', tags: ['Lyrics'] },
		},
	)
