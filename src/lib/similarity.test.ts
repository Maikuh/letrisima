import { describe, expect, test } from 'bun:test'
import { sequenceMatcherRatio } from './similarity'

describe('sequenceMatcherRatio', () => {
	test('both empty → 1.0', () => {
		expect(sequenceMatcherRatio('', '')).toBe(1.0)
	})

	test('one empty → 0.0', () => {
		expect(sequenceMatcherRatio('hello', '')).toBe(0.0)
		expect(sequenceMatcherRatio('', 'hello')).toBe(0.0)
	})

	test('identical strings → 1.0', () => {
		expect(sequenceMatcherRatio('hello', 'hello')).toBe(1.0)
		expect(sequenceMatcherRatio('shake it off', 'shake it off')).toBe(1.0)
	})

	test('completely different → 0.0', () => {
		expect(sequenceMatcherRatio('abc', 'xyz')).toBe(0.0)
	})

	test('partial overlap is between 0 and 1', () => {
		const r = sequenceMatcherRatio('hello world', 'hello earth')
		expect(r).toBeGreaterThan(0)
		expect(r).toBeLessThan(1.0)
	})

	test('symmetry: f(a,b) === f(b,a)', () => {
		expect(sequenceMatcherRatio('taylor swift', 'swift taylor')).toBe(
			sequenceMatcherRatio('swift taylor', 'taylor swift'),
		)
	})

	test('single char match', () => {
		expect(sequenceMatcherRatio('a', 'a')).toBe(1.0)
		expect(sequenceMatcherRatio('a', 'b')).toBe(0.0)
	})

	test('substring scores high', () => {
		const r = sequenceMatcherRatio('shake', 'shake it off')
		expect(r).toBeGreaterThan(0.5)
	})
})
