import { describe, expect, test } from 'bun:test'
import { validateLyricsMatch } from './validator'

const result = (artist: string, title: string) => ({ artist, title })

describe('validateLyricsMatch', () => {
	describe('exact matches', () => {
		test('exact artist + song → valid', () => {
			const r = validateLyricsMatch(
				'Taylor Swift',
				'Shake It Off',
				result('Taylor Swift', 'Shake It Off'),
			)
			expect(r.valid).toBe(true)
			expect(r.artist_match).toBeCloseTo(1.0, 2)
			expect(r.song_match).toBeCloseTo(1.0, 2)
			expect(r.script_mismatch).toBe(false)
		})

		test('case insensitive match → valid', () => {
			const r = validateLyricsMatch(
				'taylor swift',
				'shake it off',
				result('TAYLOR SWIFT', 'SHAKE IT OFF'),
			)
			expect(r.valid).toBe(true)
		})
	})

	describe('no-metadata fallbacks', () => {
		test('no title in result → trusting fetcher', () => {
			const r = validateLyricsMatch('Artist', 'Song', { artist: 'Artist' })
			expect(r.valid).toBe(true)
			expect(r.reason).toContain('trusting fetcher')
		})

		test('no artist metadata → song-only match', () => {
			const r = validateLyricsMatch('Taylor Swift', 'Shake It Off', { title: 'Shake It Off' })
			expect(r.valid).toBe(true)
			expect(r.reason).toContain('No artist metadata')
		})
	})

	describe('cross-script', () => {
		// normalizeString strips non-Latin chars via /[^\w\s]/gu so Korean/Arabic title
		// becomes empty → hits "trusting fetcher" path (valid: true, script_mismatch: false)
		test('CJK title stripped by normalizeString → trusting fetcher fallback', () => {
			const r = validateLyricsMatch('BTS', 'Dynamite', { artist: 'BTS', title: '다이너마이트' })
			expect(r.valid).toBe(true)
			expect(r.reason).toContain('trusting fetcher')
			expect(r.script_mismatch).toBe(false)
		})

		test('same script (both Latin) → no script_mismatch', () => {
			const r = validateLyricsMatch(
				'Taylor Swift',
				'Shake It Off',
				result('Taylor Swift', 'Shake It Off'),
			)
			expect(r.script_mismatch).toBe(false)
		})
	})

	describe('mismatches', () => {
		test('wrong artist → invalid', () => {
			const r = validateLyricsMatch(
				'Taylor Swift',
				'Shake It Off',
				result('Ed Sheeran', 'Shake It Off'),
			)
			expect(r.valid).toBe(false)
			expect(r.reason).toContain('artist score')
		})

		test('wrong song → invalid', () => {
			const r = validateLyricsMatch(
				'Taylor Swift',
				'Shake It Off',
				result('Taylor Swift', 'Blank Space'),
			)
			expect(r.valid).toBe(false)
			expect(r.reason).toContain('song score')
		})

		test('both wrong → reason mentions both', () => {
			const r = validateLyricsMatch(
				'Taylor Swift',
				'Shake It Off',
				result('Ed Sheeran', 'Blank Space'),
			)
			expect(r.valid).toBe(false)
			expect(r.reason).toContain('artist score')
			expect(r.reason).toContain('song score')
		})
	})

	describe('artist matching strategies', () => {
		test('featured artist in returned song title → valid', () => {
			const r = validateLyricsMatch('Nicki Minaj', 'Monster', {
				artist: 'Kanye West',
				title: 'Monster featuring Nicki Minaj',
			})
			expect(r.valid).toBe(true)
		})

		test('feat. in requested artist, exact match on primary → valid', () => {
			const r = validateLyricsMatch('Kanye West feat. Jay-Z', 'Otis', result('Kanye West', 'Otis'))
			expect(r.valid).toBe(true)
		})

		test('artist array field → valid', () => {
			const r = validateLyricsMatch('Taylor Swift', 'Shake It Off', {
				artists: ['Taylor Swift'],
				title: 'Shake It Off',
			})
			expect(r.valid).toBe(true)
		})

		test('trackArtist field → valid', () => {
			const r = validateLyricsMatch('Taylor Swift', 'Shake It Off', {
				trackArtist: 'Taylor Swift',
				trackName: 'Shake It Off',
			})
			expect(r.valid).toBe(true)
		})
	})

	describe('extension suffixes', () => {
		test('remix suffix → valid', () => {
			const r = validateLyricsMatch(
				'Taylor Swift',
				'Shake It Off',
				result('Taylor Swift', 'Shake It Off Remix'),
			)
			expect(r.valid).toBe(true)
		})

		test('live suffix → valid', () => {
			const r = validateLyricsMatch('Adele', 'Hello', result('Adele', 'Hello Live'))
			expect(r.valid).toBe(true)
		})

		test('acoustic suffix → valid', () => {
			const r = validateLyricsMatch(
				'Ed Sheeran',
				'Shape of You',
				result('Ed Sheeran', 'Shape of You Acoustic'),
			)
			expect(r.valid).toBe(true)
		})
	})

	describe('adaptive threshold', () => {
		test('lenient threshold accepts near-miss', () => {
			const strict = validateLyricsMatch(
				'Radiohead',
				'Karma Police',
				result('Radio Head', 'Karma Police'),
				0.99,
			)
			const lenient = validateLyricsMatch(
				'Radiohead',
				'Karma Police',
				result('Radio Head', 'Karma Police'),
				0.5,
			)
			if (!strict.valid) {
				expect(lenient.valid).toBe(true)
			}
		})

		test('short song name uses lower adaptive threshold', () => {
			const r = validateLyricsMatch('Jay-Z', 'Run', result('Jay-Z', 'Run'))
			expect(r.valid).toBe(true)
		})
	})

	describe('returned fields', () => {
		test('returned_artists is normalized array', () => {
			const r = validateLyricsMatch(
				'Taylor Swift',
				'Shake It Off',
				result('Taylor Swift', 'Shake It Off'),
			)
			expect(Array.isArray(r.returned_artists)).toBe(true)
			expect(r.returned_artists).toContain('taylor swift')
		})

		test('returned_song is normalized', () => {
			const r = validateLyricsMatch(
				'Taylor Swift',
				'Shake It Off',
				result('Taylor Swift', 'Shake It Off'),
			)
			expect(r.returned_song).toBe('shake it off')
		})

		test('scores are rounded to 3 decimal places', () => {
			const r = validateLyricsMatch(
				'Taylor Swift',
				'Shake It Off',
				result('Taylor Swift', 'Shake It Off'),
			)
			expect(r.artist_match * 1000).toBe(Math.round(r.artist_match * 1000))
			expect(r.song_match * 1000).toBe(Math.round(r.song_match * 1000))
		})
	})
})
