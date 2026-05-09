import { httpGet } from '../lib/http'
import { getLogger } from '../lib/logger'

const logger = getLogger('trending-fetch')

const APPLE_MUSIC_BASE = 'https://rss.applemarketingtools.com/api/v2'
const CACHE_TTL_MS = 6 * 60 * 60 * 1000 // 6 hours

export interface TrendingSong {
	song_id: string
	title: string
	artist: string
	album: string
	rank: number
	thumbnail: string | null
	duration_seconds: number | null
	explicit: boolean
	genre: string | null
	url: string | null
	timestamp: string
}

interface CacheEntry {
	data: TrendingSong[]
	fetchedAt: number
}

const cache = new Map<string, CacheEntry>()

function isCacheValid(country: string): boolean {
	const entry = cache.get(country)
	return entry != null && Date.now() - entry.fetchedAt < CACHE_TTL_MS
}

function parseSongs(raw: unknown, country: string, limit: number): TrendingSong[] {
	const songs: TrendingSong[] = []
	let items: unknown[] = []

	if (raw && typeof raw === 'object') {
		const obj = raw as Record<string, unknown>
		if ('feed' in obj && obj.feed && typeof obj.feed === 'object') {
			const feed = obj.feed as Record<string, unknown>
			if (Array.isArray(feed.results)) items = feed.results
		} else if (Array.isArray(obj.results)) {
			items = obj.results
		}
	} else if (Array.isArray(raw)) {
		items = raw
	}

	for (let idx = 0; idx < Math.min(items.length, limit); idx++) {
		const item = items[idx]
		if (!item || typeof item !== 'object') continue
		const it = item as Record<string, unknown>

		const title = String(it.name ?? it.title ?? it.trackName ?? '')
		if (!title) continue

		let artist = 'Unknown'
		if (typeof it.artistName === 'string') {
			artist = it.artistName
		} else if (it.artists && Array.isArray(it.artists) && it.artists.length > 0) {
			const a = it.artists[0]
			artist = typeof a === 'object' ? String((a as Record<string, unknown>).name ?? '') : String(a)
		}

		let album = 'Unknown'
		if (typeof it.albumName === 'string') album = it.albumName

		let thumbnail: string | null = null
		if (typeof it.artworkUrl100 === 'string') thumbnail = it.artworkUrl100
		else if (it.artwork && typeof it.artwork === 'object') {
			thumbnail = String((it.artwork as Record<string, unknown>).url ?? '') || null
		}

		let duration: number | null = null
		if (typeof it.durationMs === 'number') duration = Math.floor(it.durationMs / 1000)

		const explicit = it.contentAdvisoryRating === 'explicit' || it.isExplicit === true

		let genre: string | null = null
		if (Array.isArray(it.genres) && it.genres.length > 0) {
			const g = it.genres[0]
			genre = typeof g === 'object' ? String((g as Record<string, unknown>).name ?? '') : String(g)
		}

		const url = typeof it.url === 'string' ? it.url : null
		const song_id = String(it.id ?? it.adamId ?? `song_${idx}`)

		songs.push({
			song_id,
			title,
			artist,
			album,
			rank: songs.length + 1,
			thumbnail,
			duration_seconds: duration,
			explicit,
			genre,
			url,
			timestamp: new Date().toISOString(),
		})
	}

	logger.info(`Parsed ${songs.length} trending songs for ${country.toUpperCase()}`)
	return songs
}

export async function fetchTrending(country: string, limit = 50): Promise<TrendingSong[]> {
	const cc = country.toLowerCase()
	const cap = Math.min(Math.max(limit, 1), 200)

	const cached = isCacheValid(cc) ? cache.get(cc) : undefined
	if (cached) {
		logger.info(`Cache hit: trending ${cc.toUpperCase()}`)
		return cached.data
	}

	const url = `${APPLE_MUSIC_BASE}/${cc}/music/most-played/${cap}/songs.json`
	logger.debug(`Fetching trending from Apple Music: ${cc.toUpperCase()}`)

	try {
		const res = await httpGet(url, { timeoutMs: 10_000 })
		if (!res.ok) throw new Error(`Apple Music returned ${res.status}`)
		const raw = await res.json()
		const songs = parseSongs(raw, cc, cap)
		cache.set(cc, { data: songs, fetchedAt: Date.now() })
		return songs
	} catch (err) {
		logger.error(`Trending fetch failed for ${cc.toUpperCase()}: ${err}`)
		const stale = cache.get(cc)
		if (stale) {
			logger.info(`Returning stale cache for ${cc.toUpperCase()}`)
			return stale.data
		}
		return []
	}
}

export async function fetchTrendingByCountries(
	countries: string[],
	limit = 50,
): Promise<Record<string, TrendingSong[]>> {
	const results = await Promise.allSettled(
		countries.map(async (c) => ({
			country: c.toUpperCase(),
			songs: await fetchTrending(c, limit),
		})),
	)
	const out: Record<string, TrendingSong[]> = {}
	for (const r of results) {
		if (r.status === 'fulfilled') out[r.value.country] = r.value.songs
	}
	return out
}

export function clearTrendingCache(): string[] {
	const cleared = [...cache.keys()].map((k) => k.toUpperCase())
	cache.clear()
	return cleared
}

export function getTrendingCacheStatus(): Record<string, unknown> {
	const details: Record<string, unknown> = {}
	for (const [country, entry] of cache) {
		const ageMs = Date.now() - entry.fetchedAt
		details[country.toUpperCase()] = {
			cached_at: new Date(entry.fetchedAt).toISOString(),
			age_minutes: Math.floor(ageMs / 60_000),
			is_valid: ageMs < CACHE_TTL_MS,
			songs_count: entry.data.length,
		}
	}
	return {
		total_cached_countries: cache.size,
		cache_ttl_hours: CACHE_TTL_MS / 3_600_000,
		cache_details: details,
	}
}
