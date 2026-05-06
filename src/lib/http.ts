import ky from 'ky'

const DEFAULT_HEADERS = {
	'User-Agent':
		'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
	'Accept-Language': 'en-US,en;q=0.9',
}

export interface FetchOptions {
	timeoutMs?: number
	retries?: number
	retryDelayMs?: number
	headers?: Record<string, string>
	signal?: AbortSignal
}

export async function httpGet(url: string, opts: FetchOptions = {}): Promise<Response> {
	const { timeoutMs = 12_000, retries = 0, retryDelayMs = 400, headers, signal } = opts
	return ky.get(url, {
		headers: { ...DEFAULT_HEADERS, ...headers },
		timeout: timeoutMs,
		throwHttpErrors: false,
		signal,
		retry:
			retries > 0 ? { limit: retries, delay: (n) => retryDelayMs * n, retryOnTimeout: true } : 0,
	})
}
