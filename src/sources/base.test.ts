import { describe, expect, test } from 'bun:test'
import { buildResult, parseLrc } from './base'

describe('buildResult', () => {
	test('basic fields populated', () => {
		const r = buildResult({
			source: 'lrclib',
			artist: 'Taylor Swift',
			title: 'Shake It Off',
			lyrics: 'test',
		})
		expect(r.source).toBe('lrclib')
		expect(r.artist).toBe('Taylor Swift')
		expect(r.title).toBe('Shake It Off')
		expect(r.lyrics).toBe('test')
		expect(r.hasTimestamps).toBe(false)
		expect(typeof r.timestamp).toBe('string')
	})

	test('null lyrics → empty string', () => {
		const r = buildResult({ source: 'x', artist: 'a', title: 'b', lyrics: null })
		expect(r.lyrics).toBe('')
	})

	test('timed_lyrics sets hasTimestamps = true', () => {
		const timed = [{ id: 'lrc_0', text: 'Hello', start_time: 0, end_time: 4000 }]
		const r = buildResult({ source: 'x', artist: 'a', title: 'b', timed_lyrics: timed })
		expect(r.hasTimestamps).toBe(true)
		expect(r.timed_lyrics).toEqual(timed)
	})

	test('has_timestamps flag without timed_lyrics', () => {
		const r = buildResult({ source: 'x', artist: 'a', title: 'b', has_timestamps: true })
		expect(r.hasTimestamps).toBe(true)
	})

	test('extra keys forwarded', () => {
		const r = buildResult({ source: 'x', artist: 'a', title: 'b', album: 'My Album' } as Parameters<
			typeof buildResult
		>[0])
		expect((r as Record<string, unknown>).album).toBe('My Album')
	})

	test('timestamp is ISO-style string', () => {
		const r = buildResult({ source: 'x', artist: 'a', title: 'b' })
		expect(r.timestamp).toMatch(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/)
	})
})

describe('parseLrc', () => {
	test('parses basic LRC lines', () => {
		const lrc = '[00:10.00]Hello world\n[00:15.50]Second line'
		const lines = parseLrc(lrc)
		expect(lines).toHaveLength(2)
		expect(lines[0].text).toBe('Hello world')
		expect(lines[0].start_time).toBe(10_000)
		expect(lines[0].end_time).toBe(15_500)
		expect(lines[1].text).toBe('Second line')
		expect(lines[1].start_time).toBe(15_500)
	})

	test('last line end_time uses totalDurationMs when provided', () => {
		const lrc = '[00:10.00]Only line'
		const lines = parseLrc(lrc, 60_000)
		expect(lines[0].end_time).toBe(60_000)
	})

	test('last line end_time defaults to start + 4000 when no duration', () => {
		const lrc = '[00:10.00]Only line'
		const lines = parseLrc(lrc)
		expect(lines[0].end_time).toBe(10_000 + 4_000)
	})

	test('empty LRC → empty array', () => {
		expect(parseLrc('')).toHaveLength(0)
	})

	test('non-LRC lines ignored', () => {
		const lrc = '[ti:Title]\n[ar:Artist]\n[00:05.00]Actual lyric'
		const lines = parseLrc(lrc)
		expect(lines).toHaveLength(1)
		expect(lines[0].text).toBe('Actual lyric')
	})

	test('lines without text are skipped', () => {
		const lrc = '[00:05.00]\n[00:10.00]Real lyric'
		const lines = parseLrc(lrc)
		expect(lines).toHaveLength(1)
		expect(lines[0].text).toBe('Real lyric')
	})

	test('ids are sequential lrc_N', () => {
		const lrc = '[00:01.00]A\n[00:02.00]B\n[00:03.00]C'
		const lines = parseLrc(lrc)
		expect(lines[0].id).toBe('lrc_0')
		expect(lines[1].id).toBe('lrc_1')
		expect(lines[2].id).toBe('lrc_2')
	})

	test('minutes correctly convert to ms', () => {
		const lrc = '[02:30.00]Two and a half minutes'
		const lines = parseLrc(lrc)
		expect(lines[0].start_time).toBe(150_000)
	})
})
