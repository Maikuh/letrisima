# Letrisima

Multi-source lyrics API built with [Bun](https://bun.sh) and [Elysia](https://elysiajs.com). Fetches lyrics from 8 providers with caching, trending charts, search analytics, and OpenAPI docs.

## Features

- **Multi-source fetching** — Genius, LRCLIB, SimpMusic, YouTube, LyricsOVH, ChartLyrics, LyricsFreek, Letras.com
- **Timestamped lyrics** — synced (LRC) lyrics when available
- **Metadata enrichment** — album art, release date, MusicBrainz data
- **Trending** — top songs by country via Last.fm
- **Suggestions** — artist/song autocomplete via MusicBrainz
- **In-memory cache** — configurable TTL (default 24h)
- **Analytics** — tracks search queries per country
- **Rate limiting** — 15 req/min per IP
- **OpenAPI docs** — available at `/docs`

## Quick Start

```bash
bun install
bun run dev
```

Server starts at `http://localhost:4000`. Docs at `http://localhost:4000/docs`.

## Environment Variables

| Variable | Default | Description |
|---|---|---|
| `PORT` | `4000` | Server port |
| `GENIUS_TOKEN` | — | Genius API token (enables Genius source) |
| `LRCLIB_API_BASE` | `https://lrclib.net/api` | Override LRCLIB endpoint |
| `ADMIN_KEY` | — | Key for cache admin endpoints |
| `CACHE_TTL` | `86400` | Cache TTL in seconds |
| `LOG_LEVEL` | `INFO` | Log level (`DEBUG`, `INFO`, `WARN`, `ERROR`) |

## API

### Lyrics

```
GET /lyrics?artist=<artist>&song=<song>
```

| Param | Type | Description |
|---|---|---|
| `artist` | string | Artist name |
| `song` | string | Song title |
| `timestamps` | boolean | Request synced/LRC lyrics |
| `timestamp` | boolean | Alias for `timestamps` |
| `fast` | boolean | Parallel fetch from LRCLIB + SimpMusic only, return first valid result |
| `country` | string | 2-letter country code (default `US`) |
| `source` | string | Pin to a single source (`genius`, `lrclib`, `simpmusic`, `youtube`, `lyricsovh`, `chartlyrics`, `lyricsfreek`, `letras`) |
| `pass` | boolean | Enable custom fetcher sequence (requires `sequence`) |
| `sequence` | string | Comma-separated fetcher IDs 1–7 (used with `pass=true`) |

### Trending

```
GET /trending?country=<code>
```

Returns top tracks for the given country.

### Suggestions

```
GET /suggestion?q=<query>
```

Artist/song autocomplete via MusicBrainz.

### Analytics

```
GET /analytics
```

Top searched tracks per country.

### Cache (admin)

```
GET    /admin/cache          # cache stats
DELETE /admin/cache          # clear cache
DELETE /admin/cache/:key     # evict single entry
```

Requires `x-admin-key` header matching `ADMIN_KEY`.

## Scripts

```bash
bun run dev       # dev server with hot reload
bun run start     # production
bun run lint      # check with Biome
bun run lint:fix  # fix lint issues
bun run format    # format with Biome
```
