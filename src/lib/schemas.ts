import { t } from 'elysia'

export const ErrorResponse = t.Object(
	{
		status: t.Literal('error'),
		error: t.Object({
			message: t.String(),
			details: t.Optional(t.Union([t.String(), t.Record(t.String(), t.Unknown())])),
			timestamp: t.String(),
		}),
	},
	{ $id: 'ErrorResponse' },
)

export const TimedLine = t.Object(
	{
		id: t.String(),
		text: t.String(),
		start_time: t.Number(),
		end_time: t.Number(),
	},
	{ $id: 'TimedLine' },
)

export const LyricData = t.Object(
	{
		source: t.String(),
		artist: t.String(),
		title: t.String(),
		lyrics: t.String(),
		hasTimestamps: t.Boolean(),
		timestamp: t.String(),
		timed_lyrics: t.Optional(t.Array(TimedLine)),
	},
	{ $id: 'LyricData' },
)

export const LyricsResponse = t.Object(
	{
		data: LyricData,
		validation: t.Optional(
			t.Object({
				artist_match: t.Number(),
				song_match: t.Number(),
				reason: t.Optional(t.String()),
				script_mismatch: t.Optional(t.Boolean()),
			}),
		),
	},
	{ $id: 'LyricsResponse' },
)

export const TrendingSong = t.Object(
	{
		song_id: t.String(),
		title: t.String(),
		artist: t.String(),
		album: t.String(),
		rank: t.Number(),
		thumbnail: t.Nullable(t.String()),
		duration_seconds: t.Nullable(t.Number()),
		explicit: t.Boolean(),
		genre: t.Nullable(t.String()),
		url: t.Nullable(t.String()),
		timestamp: t.String(),
	},
	{ $id: 'TrendingSong' },
)

export const TrendingResponse = t.Object(
	{
		country: t.String(),
		trending: t.Array(TrendingSong),
		total: t.Number(),
	},
	{ $id: 'TrendingResponse' },
)

export const TrendingByCountriesResponse = t.Object(
	{
		countries: t.Record(t.String(), t.Array(TrendingSong)),
		total_countries: t.Number(),
	},
	{ $id: 'TrendingByCountriesResponse' },
)

export const QueryCount = t.Object({ query: t.String(), count: t.Number() }, { $id: 'QueryCount' })

export const TopQueriesResponse = t.Object(
	{
		limit: t.Number(),
		country: t.String(),
		days: t.Nullable(t.Number()),
		total: t.Number(),
		queries: t.Array(QueryCount),
	},
	{ $id: 'TopQueriesResponse' },
)

export const TrendingByCountryResponse = t.Object(
	{
		limit: t.Number(),
		data: t.Record(t.String(), t.Array(QueryCount)),
	},
	{ $id: 'TrendingByCountryResponse' },
)

export const TrendingVsQueriesResponse = t.Object(
	{
		country: t.String(),
		trending_songs: t.Array(TrendingSong),
		top_user_queries: t.Array(QueryCount),
		trending_titles: t.Array(t.String()),
	},
	{ $id: 'TrendingVsQueriesResponse' },
)

export const TrendingIntersectionMatch = t.Object(
	{
		query: t.String(),
		count: t.Number(),
		matched_song: t.String(),
		matched_artist: t.String(),
		rank: t.Number(),
	},
	{ $id: 'TrendingIntersectionMatch' },
)

export const TrendingIntersectionResponse = t.Object(
	{
		country: t.String(),
		total: t.Number(),
		matches: t.Array(TrendingIntersectionMatch),
	},
	{ $id: 'TrendingIntersectionResponse' },
)

export const AnalyticsStatus = t.Object(
	{
		total_recorded_queries: t.Number(),
		unique_global_queries: t.Number(),
		countries_with_queries: t.Number(),
	},
	{ $id: 'AnalyticsStatus' },
)

export const SuggestionItem = t.Object(
	{ title: t.String(), artist: t.String() },
	{ $id: 'SuggestionItem' },
)

export const SuggestionResponse = t.Object(
	{
		query: t.String(),
		limit: t.Number(),
		total: t.Number(),
		results: t.Array(SuggestionItem),
	},
	{ $id: 'SuggestionResponse' },
)

export const CacheStats = t.Object(
	{
		cache_keys: t.Number(),
		ttl_seconds: t.Number(),
		version: t.String(),
	},
	{ $id: 'CacheStats' },
)

export const HealthResponse = t.Object(
	{
		api: t.String(),
		version: t.String(),
		status: t.String(),
		docs: t.String(),
		timestamp: t.String(),
	},
	{ $id: 'HealthResponse' },
)
