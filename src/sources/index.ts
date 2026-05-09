import type { Fetcher } from './base'
import { chartlyricsFetcher } from './chartlyrics'
import { geniusFetcher } from './genius'
import { letrasFetcher } from './letras'
import { lrclibFetcher } from './lrclib'
import { lyricsfreekFetcher } from './lyricsfreek'
import { lyricsovhFetcher } from './lyricsovh'
import { mxmFetcher } from './mxm'
import { simpmusicFetcher } from './simpmusic'
import { youtubeFetcher } from './youtube'

export interface SourceDescriptor {
	key: string
	fetcher: Fetcher
}

export const SOURCES: readonly SourceDescriptor[] = [
	{ key: 'genius', fetcher: geniusFetcher },
	{ key: 'lrclib', fetcher: lrclibFetcher },
	{ key: 'mxm', fetcher: mxmFetcher },
	{ key: 'simpmusic', fetcher: simpmusicFetcher },
	{ key: 'youtube', fetcher: youtubeFetcher },
	{ key: 'lyricsovh', fetcher: lyricsovhFetcher },
	{ key: 'chartlyrics', fetcher: chartlyricsFetcher },
	{ key: 'letras', fetcher: letrasFetcher },
	{ key: 'lyricsfreek', fetcher: lyricsfreekFetcher },
]

export const SOURCE_BY_KEY = new Map(SOURCES.map((s) => [s.key, s]))

export const SOURCE_KEYS = Object.fromEntries(SOURCES.map((s) => [s.key, s.key])) as Record<
	string,
	string
>
export type SourceKey = (typeof SOURCES)[number]['key']
