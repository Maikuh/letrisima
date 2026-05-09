import { config } from './config'

const CACHE_VERSION = 'v2'

interface CacheEntry {
	expiry: number
	result: unknown
}

const store = new Map<string, CacheEntry>()

interface CacheKeyParams {
	artist: string
	song: string
	timestamps: boolean
	sequence: string | null
	fast: boolean
	source?: string | null
}

export async function makeCacheKey(p: CacheKeyParams): Promise<string> {
	const payload = JSON.stringify({
		v: CACHE_VERSION,
		artist: (p.artist ?? '').trim().toLowerCase(),
		song: (p.song ?? '').trim().toLowerCase(),
		timestamps: Boolean(p.timestamps),
		sequence: p.sequence ?? '',
		fast: Boolean(p.fast),
		source: p.source ?? '',
	})
	const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(payload))
	return Array.from(new Uint8Array(buf))
		.map((b) => b.toString(16).padStart(2, '0'))
		.join('')
}

export function loadFromCache(key: string): unknown | null {
	const entry = store.get(key)
	if (!entry) return null
	if (Date.now() / 1000 > entry.expiry) {
		store.delete(key)
		return null
	}
	return entry.result
}

export function saveToCache(key: string, result: unknown): void {
	store.set(key, { expiry: Date.now() / 1000 + config.cache.ttl, result })
}

export function clearCache(): { removed: number } {
	const count = store.size
	store.clear()
	return { removed: count }
}

export function cacheStats() {
	return {
		cache_keys: store.size,
		ttl_seconds: config.cache.ttl,
		version: CACHE_VERSION,
	}
}
