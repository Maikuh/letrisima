import type { Fetcher } from './base'
import { chartlyricsFetcher } from './chartlyrics'
import { geniusFetcher } from './genius'
import { letrasFetcher } from './letras'
import { lrclibFetcher } from './lrclib'
import { lyricsfreekFetcher } from './lyricsfreek'
import { lyricsovhFetcher } from './lyricsovh'
import { simpmusicFetcher } from './simpmusic'
import { youtubeFetcher } from './youtube'

export interface SourceDescriptor {
	id: number
	key: string
	displayName: string
	fetcher: Fetcher
}

export const SOURCES: readonly SourceDescriptor[] = [
	{ id: 1, key: 'genius', displayName: 'Genius', fetcher: geniusFetcher },
	{ id: 2, key: 'lrclib', displayName: 'LRCLIB', fetcher: lrclibFetcher },
	{ id: 3, key: 'simpmusic', displayName: 'SimpMusic', fetcher: simpmusicFetcher },
	{ id: 4, key: 'youtube', displayName: 'YouTube Music', fetcher: youtubeFetcher },
	{ id: 5, key: 'lyricsovh', displayName: 'Lyrics.ovh', fetcher: lyricsovhFetcher },
	{ id: 6, key: 'chartlyrics', displayName: 'ChartLyrics', fetcher: chartlyricsFetcher },
	{ id: 7, key: 'letras', displayName: 'Letras', fetcher: letrasFetcher },
	{ id: 8, key: 'lyricsfreek', displayName: 'LyricsFreek', fetcher: lyricsfreekFetcher },
]

export const SOURCE_BY_ID = new Map(SOURCES.map((s) => [s.id, s]))
export const SOURCE_BY_KEY = new Map(SOURCES.map((s) => [s.key, s]))

export const SOURCE_KEYS = Object.fromEntries(SOURCES.map((s) => [s.key, s.key])) as Record<
	string,
	string
>
export type SourceKey = (typeof SOURCES)[number]['key']
