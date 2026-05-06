export const PORT = Number(process.env.PORT ?? 4000)
export const LOG_LEVEL = (process.env.LOG_LEVEL ?? 'INFO').toUpperCase()
export const ADMIN_KEY = process.env.ADMIN_KEY ?? ''
export const GENIUS_TOKEN = process.env.GENIUS_TOKEN ?? ''
export const LRCLIB_API_BASE = process.env.LRCLIB_API_BASE ?? 'https://lrclib.net/api'
export const CACHE_TTL = Number(process.env.CACHE_TTL ?? 86400)
