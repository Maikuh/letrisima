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
	key: string
	displayName: string
	fetcher: Fetcher
}

export const SOURCES: readonly SourceDescriptor[] = [
	{ key: 'genius', displayName: 'Genius', fetcher: geniusFetcher },
	{ key: 'lrclib', displayName: 'LRCLIB', fetcher: lrclibFetcher },
	{ key: 'simpmusic', displayName: 'SimpMusic', fetcher: simpmusicFetcher },
	{ key: 'youtube', displayName: 'YouTube Music', fetcher: youtubeFetcher },
	{ key: 'lyricsovh', displayName: 'Lyrics.ovh', fetcher: lyricsovhFetcher },
	{ key: 'chartlyrics', displayName: 'ChartLyrics', fetcher: chartlyricsFetcher },
	{ key: 'letras', displayName: 'Letras', fetcher: letrasFetcher },
	{ key: 'lyricsfreek', displayName: 'LyricsFreek', fetcher: lyricsfreekFetcher },
]

export const SOURCE_BY_KEY = new Map(SOURCES.map((s) => [s.key, s]))

export const SOURCE_KEYS = Object.fromEntries(SOURCES.map((s) => [s.key, s.key])) as Record<
	string,
	string
>
export type SourceKey = (typeof SOURCES)[number]['key']
