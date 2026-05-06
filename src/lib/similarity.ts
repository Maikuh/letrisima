/** Ratcliff/Obershelp gestalt-pattern-matching similarity. */
export function sequenceMatcherRatio(a: string, b: string): number {
	if (!a && !b) return 1.0
	if (!a || !b) return 0.0
	const matches = _countMatches(a, b)
	return (2 * matches) / (a.length + b.length)
}

function _countMatches(a: string, b: string): number {
	if (!a || !b) return 0
	let longest = 0
	let longestI = 0
	let longestJ = 0

	for (let i = 0; i < a.length; i++) {
		for (let j = 0; j < b.length; j++) {
			let k = 0
			while (i + k < a.length && j + k < b.length && a[i + k] === b[j + k]) k++
			if (k > longest) {
				longest = k
				longestI = i
				longestJ = j
			}
		}
	}

	if (!longest) return 0

	return (
		longest +
		_countMatches(a.slice(0, longestI), b.slice(0, longestJ)) +
		_countMatches(a.slice(longestI + longest), b.slice(longestJ + longest))
	)
}
