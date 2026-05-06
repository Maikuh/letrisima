import type { Fetcher } from './base'
import { chartlyricsFetcher } from './chartlyrics'
import { geniusFetcher } from './genius'
import { letrasFetcher } from './letras'
import { lrclibFetcher } from './lrclib'
import { lyricsfreekFetcher } from './lyricsfreek'
import { lyricsovhFetcher } from './lyricsovh'
import { simpmusicFetcher } from './simpmusic'
import { youtubeFetcher } from './youtube'

export const SOURCE_KEYS = {
	genius: 'genius',
	lrclib: 'lrclib',
	simpmusic: 'simpmusic',
	youtube: 'youtube',
	lyricsovh: 'lyricsovh',
	chartlyrics: 'chartlyrics',
	lyricsfreek: 'lyricsfreek',
	letras: 'letras',
} as const

export type SourceKey = (typeof SOURCE_KEYS)[keyof typeof SOURCE_KEYS]

export const ALL_FETCHERS: Record<string, Fetcher> = {
	genius: geniusFetcher,
	lrclib: lrclibFetcher,
	simpmusic: simpmusicFetcher,
	youtube: youtubeFetcher,
	lyricsovh: lyricsovhFetcher,
	chartlyrics: chartlyricsFetcher,
	lyricsfreek: lyricsfreekFetcher,
	letras: letrasFetcher,
}
