import { getLogger } from '../lib/logger'

const logger = getLogger('trending-analytics')

const MAX_QUERIES = 10_000

interface StoredQuery {
	query: string
	normalized: string
	country: string
	timestamp: Date
}

const queryLog: StoredQuery[] = []
const globalCounts = new Map<string, number>()
const countryCounts = new Map<string, Map<string, number>>()

export function recordUserQuery(userId: string, query: string, country: string): void {
	const normalized = query.toLowerCase().trim()
	const entry: StoredQuery = {
		query,
		normalized,
		country: country.toUpperCase(),
		timestamp: new Date(),
	}

	if (queryLog.length >= MAX_QUERIES) queryLog.shift()
	queryLog.push(entry)

	globalCounts.set(normalized, (globalCounts.get(normalized) ?? 0) + 1)

	const cc = country.toUpperCase()
	if (!countryCounts.has(cc)) countryCounts.set(cc, new Map())
	const cm = countryCounts.get(cc)
	if (cm) cm.set(normalized, (cm.get(normalized) ?? 0) + 1)

	logger.debug(`Recorded query: "${query}" from ${userId} in ${cc}`)
}

export function getTopQueries(
	limit = 20,
	country?: string,
	days?: number,
): Array<[string, number]> {
	const cap = Math.min(Math.max(limit, 1), 100)

	let counts: Map<string, number>

	if (country) {
		counts = new Map(countryCounts.get(country.toUpperCase()) ?? [])
	} else {
		counts = new Map(globalCounts)
	}

	if (days != null) {
		const cutoff = new Date(Date.now() - days * 86_400_000)
		const filtered = new Map<string, number>()
		for (const q of queryLog) {
			if (q.timestamp >= cutoff) {
				if (!country || q.country === country.toUpperCase()) {
					filtered.set(q.normalized, (filtered.get(q.normalized) ?? 0) + 1)
				}
			}
		}
		counts = filtered
	}

	return [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, cap)
}

export function getTopQueriesByCountry(limit = 20): Record<string, Array<[string, number]>> {
	const cap = Math.min(Math.max(limit, 1), 100)
	const result: Record<string, Array<[string, number]>> = {}
	for (const [country, cm] of countryCounts) {
		result[country] = [...cm.entries()].sort((a, b) => b[1] - a[1]).slice(0, cap)
	}
	return result
}

export function getAnalyticsStatus() {
	return {
		total_recorded_queries: queryLog.length,
		unique_global_queries: globalCounts.size,
		countries_with_queries: countryCounts.size,
	}
}
