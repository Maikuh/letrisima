export const config = {
	port: Number(process.env.PORT ?? 4000),
	logLevel: (process.env.LOG_LEVEL ?? 'INFO').toUpperCase(),
	admin: {
		key: process.env.ADMIN_KEY ?? '',
	},
	genius: {
		token: process.env.GENIUS_TOKEN ?? '',
	},
	lrclib: {
		apiBase: process.env.LRCLIB_API_BASE ?? 'https://lrclib.net/api',
	},
	cache: {
		ttl: Number(process.env.CACHE_TTL ?? 86400),
	},
	mxm: {
		enabled: (process.env.MXM_ENABLED ?? 'true').toLowerCase() !== 'false',
	},
	rateLimit: {
		max: Number(process.env.RATE_LIMIT_MAX ?? 15),
		duration: Number(process.env.RATE_LIMIT_DURATION ?? 60_000),
		get enabled() {
			return this.max !== 0 || this.duration !== 0
		},
	},
}
