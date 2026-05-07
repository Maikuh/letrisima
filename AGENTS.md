# AGENTS.md

This file provides guidance to AI agents when working with code in this repository.

## Commands

```bash
bun run dev        # Dev server with hot reload
bun run start      # Production server
bun run lint       # Biome lint check
bun run lint:fix   # Auto-fix lint issues
bun run format     # Biome format
```

No test suite exists.

## Architecture

Multi-source lyrics API. Bun + Elysia (TypeScript). 8 lyric provider integrations race in parallel; first valid match wins and cancels others.

### Request flow

```
GET /api/lyrics?artist=X&song=Y
  → analytics record
  → cache lookup (SHA-256 key of normalized params)
  → resolve fetch sequence
  → parallel race fetchers (35s timeout)
  → validate each result via similarity matching
  → first valid match → cache → return
```

### Fetching strategies (`src/fetcher.ts`)

| Mode | Providers |
|------|-----------|
| `fast` | LRCLIB + SimpMusic only |
| default synced | LRCLIB, SimpMusic, YouTube, Lyrics.ovh |
| default plain | all 7 providers |
| `source=N` | single pinned provider |
| `pass=true&sequence=1,2,3` | custom ordered sequence (sequential, not race) |

### Sources (`src/sources/`)

`SOURCES` array maps IDs 1–8 to fetcher implementations. Each implements `Fetcher.fetch()` returning `LyricResult | null`. Wrapped by `defineFetcher()` with try-catch + logging. New sources: implement `base.ts` interface, register in `sources/index.ts`.

### Validation (`src/lib/validator.ts`)

Multi-layer: string similarity (Levenshtein ratio, threshold 0.75), adaptive thresholds for short names, multi-artist splitting (feat./ft./&), script-mismatch auto-accept (Latin ↔ non-Latin), extension suffix matching (remix/live/acoustic), substring + reversed collab fallbacks.

### Cache (`src/lib/cache.ts`)

In-memory `Map`. Key = SHA-256(normalized query params). TTL = `CACHE_TTL` env (default 24h). Expiry checked on access, stale entries deleted then. Admin endpoints at `/api/admin/cache` require `x-admin-key` header.

### Trending (`src/trending/`)

- `fetch.ts` — Apple Music RSS per country, 6h TTL, stale-on-error fallback
- `analytics.ts` — in-memory query tracker (max 10k entries), global + per-country counts, time-window filtering

## Environment variables

| Var | Default | Notes |
|-----|---------|-------|
| `PORT` | `4000` | |
| `LOG_LEVEL` | `INFO` | DEBUG/INFO/WARN/ERROR |
| `GENIUS_TOKEN` | — | Required to enable Genius source |
| `LRCLIB_API_BASE` | `https://lrclib.net/api` | |
| `ADMIN_KEY` | — | Required for admin cache endpoints |
| `CACHE_TTL` | `86400` | Seconds |
| `NODE_ENV` | — | `production` disables pino-pretty |

## Key files

- `src/index.ts` — Elysia app init, plugin wiring
- `src/fetcher.ts` — fetch orchestration, parallel race logic
- `src/routes/index.ts` — route aggregation
- `src/lib/validator.ts` — lyrics similarity validation
- `src/lib/cache.ts` — in-memory cache
- `src/sources/index.ts` — source registry

## Notes

- Rate limit: 15 req/min per IP
- OpenAPI/Scalar docs at `/docs`
- Biome handles both lint and format (not ESLint/Prettier)
- Strict TypeScript (`strict: true`)
- LRCLIB historically slow (~16s); accounted for in parallel race design
