export const config = {
	port: Number(process.env.PORT ?? 4000),
	logLevel: (process.env.LOG_LEVEL ?? 'INFO').toUpperCase(),
	adminKey: process.env.ADMIN_KEY ?? '',
	geniusToken: process.env.GENIUS_TOKEN ?? '',
	lrclibApiBase: process.env.LRCLIB_API_BASE ?? 'https://lrclib.net/api',
	cacheTtl: Number(process.env.CACHE_TTL ?? 86400),
	mxmEnabled: (process.env.MXM_ENABLED ?? 'true').toLowerCase() !== 'false',
}
