import { getLogger } from './lib/logger'
import { type ValidationResult, validateLyricsMatch } from './lib/validator'
import { SOURCE_BY_KEY, SOURCES } from './sources'
import type { LyricResult } from './sources/base'

const logger = getLogger('fetcher/fetch_controller')

const DEFAULT_SYNCED_SEQUENCE = ['lrclib', 'simpmusic', 'youtube', 'lyricsovh']
const DEFAULT_PLAIN_SEQUENCE = [
	'genius',
	'lrclib',
	'simpmusic',
	'youtube',
	'lyricsovh',
	'chartlyrics',
	'letras',
]
const FAST_MODE_SEQUENCE = ['lrclib', 'simpmusic']

function ts(): string {
	return new Date().toISOString().replace('T', ' ').slice(0, 19)
}

function errResp(msg: string) {
	return { status: 'error', error: { message: msg, timestamp: ts() } }
}

interface Attempt {
	api: string
	success: boolean
	result?: LyricResult
	validation?: ValidationResult
	reason?: string
}

async function fetchWithTimeout(
	displayName: string,
	fetcherKey: string,
	artist: string,
	song: string,
	timestamps: boolean,
	timeoutMs = 35_000,
	signal?: AbortSignal,
): Promise<Attempt> {
	const source = SOURCE_BY_KEY.get(fetcherKey)
	if (!source) return { api: displayName, success: false, reason: 'not_configured' }

	try {
		const result = await Promise.race<LyricResult | null>([
			source.fetcher.fetch(artist, song, timestamps, signal),
			new Promise<null>((_, reject) => setTimeout(() => reject(new Error('timeout')), timeoutMs)),
		])
		if (result?.lyrics) return { api: displayName, success: true, result }
		return { api: displayName, success: false, reason: 'no_lyrics' }
	} catch (e) {
		if (signal?.aborted) return { api: displayName, success: false, reason: 'aborted' }
		const reason = e instanceof Error ? e.message : String(e)
		if (reason === 'timeout')
			logger.warning(`[${displayName}] timed out after ${timeoutMs / 1000}s`)
		else logger.error(`[${displayName}] error: ${reason}`)
		return { api: displayName, success: false, reason }
	}
}

/**
 * Parallel fetch with validate-before-cancel:
 * A failed validation does NOT cancel siblings — only a passing validation does.
 */
async function fetchParallel(
	artist: string,
	song: string,
	timestamps: boolean,
	fetcherKeys: string[],
): Promise<[LyricResult | null, Attempt[]]> {
	const entries = fetcherKeys
		.map((key) => SOURCE_BY_KEY.get(key))
		.filter((s): s is NonNullable<typeof s> => s !== undefined)

	if (!entries.length) return [null, []]

	const allAttempts: Attempt[] = []
	const controller = new AbortController()
	const { signal } = controller

	type Tagged = { task: Promise<Tagged>; attempt: Attempt }
	let pending: Promise<Tagged>[] = entries.map(({ key, displayName }) => {
		const p: Promise<Tagged> = fetchWithTimeout(
			displayName,
			key,
			artist,
			song,
			timestamps,
			35_000,
			signal,
		).then((attempt) => ({ task: p, attempt }))
		return p
	})

	while (pending.length > 0) {
		const { task: resolved, attempt } = await Promise.race(pending)
		pending = pending.filter((p) => p !== resolved)

		if (attempt.reason === 'aborted') continue

		allAttempts.push(attempt)

		if (!attempt.success) {
			logger.debug(`  [${attempt.api}] skipped — ${attempt.reason}`)
			continue
		}

		const val = validateLyricsMatch(artist, song, attempt.result as Record<string, unknown>, 0.75)

		if (val.valid) {
			logger.info(
				`✓ [${attempt.api}] accepted (artist=${val.artist_match} song=${val.song_match} script_mismatch=${val.script_mismatch})`,
			)
			attempt.validation = val
			controller.abort()
			return [attempt.result as LyricResult, allAttempts]
		} else {
			logger.warning(
				`✗ [${attempt.api}] rejected: ${val.reason} — ${pending.length} fetcher(s) still running`,
			)
		}
	}

	logger.warning(`All fetchers exhausted — no valid result for '${artist} - ${song}'`)
	return [null, allAttempts]
}

const VALID_KEYS = new Set(SOURCES.map((s) => s.key))

function resolveSequence(
	fastMode: boolean,
	sequence: string | null,
	timestamps: boolean,
): { fetcherKeys: string[]; useParallel: boolean } | { error: Record<string, unknown> } {
	if (fastMode) {
		return { fetcherKeys: FAST_MODE_SEQUENCE, useParallel: true }
	}
	if (sequence) {
		const parsed = sequence
			.split(',')
			.map((x) => x.trim())
			.filter(Boolean)
		const invalid = parsed.filter((k) => !VALID_KEYS.has(k))
		if (
			!parsed.length ||
			invalid.length > 0 ||
			parsed.length > SOURCES.length ||
			new Set(parsed).size !== parsed.length
		) {
			const validList = SOURCES.map((s) => s.key).join(', ')
			return {
				error: errResp(
					invalid.length
						? `Unknown source(s): ${invalid.join(', ')}. Valid: ${validList}`
						: `Invalid sequence: must be unique, non-empty keys from: ${validList}`,
				),
			}
		}
		return { fetcherKeys: parsed, useParallel: parsed.length > 1 }
	}
	return {
		fetcherKeys: timestamps ? DEFAULT_SYNCED_SEQUENCE : DEFAULT_PLAIN_SEQUENCE,
		useParallel: true,
	}
}

function buildParallelSuccess(result: LyricResult, attempts: Attempt[]): Record<string, unknown> {
	const response: Record<string, unknown> = { data: result }
	const match = attempts.find((a) => a.result === result && a.validation)
	if (match?.validation) {
		const v = match.validation
		if (v.artist_match < 1.0 || v.song_match < 1.0) {
			response.validation = {
				artist_match: v.artist_match,
				song_match: v.song_match,
				reason: v.reason,
				script_mismatch: v.script_mismatch,
			}
		}
	}
	return response
}

export async function fetchLyricsController(
	artistName: string,
	songTitle: string,
	timestamps = false,
	sequence: string | null = null,
	fastMode = false,
	source: string | null = null,
): Promise<Record<string, unknown>> {
	if (source) {
		const descriptor = SOURCE_BY_KEY.get(source)
		if (!descriptor)
			return errResp(`Unknown source '${source}'. Valid: ${SOURCES.map((s) => s.key).join(', ')}`)

		try {
			const raw = await Promise.race<LyricResult | null>([
				descriptor.fetcher.fetch(artistName, songTitle, timestamps),
				new Promise<null>((_, reject) => setTimeout(() => reject(new Error('timeout')), 35_000)),
			])
			if (!raw?.lyrics)
				return errResp(`No lyrics found via '${source}' for '${songTitle}' by '${artistName}'`)
			return { data: raw }
		} catch (e) {
			return errResp(`Source '${source}' failed: ${e}`)
		}
	}

	const resolved = resolveSequence(fastMode, sequence, timestamps)
	if ('error' in resolved) return resolved.error
	const { fetcherKeys, useParallel } = resolved

	if (useParallel) {
		const [result, attempts] = await fetchParallel(artistName, songTitle, timestamps, fetcherKeys)
		if (result) return buildParallelSuccess(result, attempts)
		const sourcesWithResults = attempts.filter((a) => a.success).map((a) => a.api)
		if (sourcesWithResults.length) {
			return errResp(
				`Found results from ${sourcesWithResults.join(', ')} but none matched '${songTitle}' by '${artistName}'`,
			)
		}
		return errResp(`No lyrics found for '${songTitle}' by '${artistName}'`)
	}

	for (const key of fetcherKeys) {
		const descriptor = SOURCE_BY_KEY.get(key)
		if (!descriptor) continue
		const { displayName, fetcher } = descriptor
		try {
			const raw = await Promise.race<LyricResult | null>([
				fetcher.fetch(artistName, songTitle, timestamps),
				new Promise<null>((_, reject) => setTimeout(() => reject(new Error('timeout')), 35_000)),
			])
			if (!raw?.lyrics) continue
			const val = validateLyricsMatch(artistName, songTitle, raw as Record<string, unknown>, 0.75)
			if (val.valid) {
				logger.info(
					`✓ [${displayName}] accepted (artist=${val.artist_match} song=${val.song_match})`,
				)
				return { data: raw }
			} else {
				logger.warning(`✗ [${displayName}] rejected: ${val.reason} — trying next fetcher`)
			}
		} catch (e) {
			logger.error(`[${displayName}] exception: ${e}`)
		}
	}

	return errResp(`No lyrics found for '${songTitle}' by '${artistName}'`)
}
