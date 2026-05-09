import { getLogger } from '../lib/logger'

export interface TimedLine {
	id: string
	text: string
	start_time: number
	end_time: number
}

export interface LyricResult {
	source: string
	artist: string
	title: string
	lyrics: string
	hasTimestamps: boolean
	timestamp: string
	timed_lyrics?: TimedLine[]
	[key: string]: unknown
}

export interface BuildResultParams {
	source: string
	artist: string
	title: string
	lyrics?: string | null
	timed_lyrics?: TimedLine[] | null
	has_timestamps?: boolean
	[key: string]: unknown
}

export function buildResult(p: BuildResultParams): LyricResult {
	const result: LyricResult = {
		source: p.source,
		artist: p.artist,
		title: p.title,
		lyrics: p.lyrics ?? '',
		hasTimestamps: Boolean(p.has_timestamps),
		timestamp: new Date().toISOString().replace('T', ' ').slice(0, 19),
	}
	if (p.timed_lyrics?.length) {
		result.timed_lyrics = p.timed_lyrics
		result.hasTimestamps = true
	}
	// forward any extra keys
	for (const [k, v] of Object.entries(p)) {
		if (!(k in result) && k !== 'has_timestamps') {
			result[k] = v
		}
	}
	return result
}

const LRC_RE = /\[(\d{2}:\d{2}\.?\d{0,3})\](.*)/

export function parseLrc(lrcText: string, totalDurationMs?: number): TimedLine[] {
	const lines = lrcText.split('\n')
	const parsed: Array<{ text: string; start_time: number }> = []

	for (const line of lines) {
		const m = LRC_RE.exec(line)
		if (!m) continue
		const timeStr = m[1].replace('..', '.')
		const text = m[2].trim()
		try {
			const [minStr, secStr] = timeStr.split(':')
			const startMs = Math.floor((parseInt(minStr, 10) * 60 + parseFloat(secStr)) * 1000)
			if (text) parsed.push({ text, start_time: startMs })
		} catch {}
	}

	return parsed.map((entry, i): TimedLine => {
		const next = parsed[i + 1]
		const end_time = next ? next.start_time : (totalDurationMs ?? entry.start_time + 4000)
		return { id: `lrc_${i}`, text: entry.text, start_time: entry.start_time, end_time }
	})
}

export interface Fetcher {
	fetch(
		artist: string,
		song: string,
		timestamps: boolean,
		signal?: AbortSignal,
	): Promise<LyricResult | null>
}

export interface FetcherDef {
	source: string
	displayName: string
	run(
		artist: string,
		song: string,
		timestamps: boolean,
		signal?: AbortSignal,
	): Promise<LyricResult | null>
}

export function defineFetcher(def: FetcherDef): Fetcher {
	const log = getLogger(`fetcher/${def.source}`)
	return {
		async fetch(artist, song, timestamps, signal) {
			try {
				log.debug(`${def.displayName}: fetching '${artist} – ${song}'`)
				return await def.run(artist, song, timestamps, signal)
			} catch (err) {
				if (err instanceof DOMException) {
					if (err.name === 'AbortError') {
						log.debug(`${def.displayName} fetch aborted.`)
						return null
					}
				}

				log.error(`${def.displayName} error: ${err}`)
				return null
			}
		},
	}
}
