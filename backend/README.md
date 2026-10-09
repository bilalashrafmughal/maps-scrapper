# Google Maps Scraper — Backend

Node/Express API that runs Google Maps scraping campaigns via Playwright and
stores the results in MySQL.

## Structure

```
src/
  index.js                 # Bootstrap: DB init, HTTP server, graceful shutdown, resume
  app.js                   # Express app assembly (middleware, routes, error handling)
  config/
    env.js                 # .env loader + runtime config
    constants.js           # statuses, defaults, limits
  db/
    pool.js                # MySQL pool singleton
    schema.js              # Table + index DDL (idempotent)
  errors/
    ApiError.js            # Typed HTTP errors
    asyncHandler.js        # Async route wrapper
    errorHandler.js        # JSON 404 + central error middleware
  views/
    apiIndexPage.js        # Landing page listing endpoints
  modules/
    map-scraper/           # ← the map scraper module
      index.js             # Public surface: router, service, resume()
      mapScraper.routes.js # Route table
      mapScraper.controller.js
      mapScraper.service.js
      dto/campaign.dto.js  # Request validation/normalisation
      repositories/        # Data access (campaign, location, business, stats)
      scraper/             # Google Maps engine, email pipeline, worker, scheduler, exporter
```

Request flow: **route → controller → service → repository → MySQL**.

## Email research pipeline

`scraper/emailExtractor.js` builds on the
[`email-scraper`](https://github.com/web-scraping-tools/email-scraper) library to
research a business website for contact addresses.

> **Install note:** the library is **not on npm** — the npm name `email-scraper`
> is taken by an unrelated package. It is installed from GitHub as
> `github:web-scraping-tools/email-scraper`. The repo ships TypeScript source
> only (`dist/` is gitignored), so `scripts/build-email-scraper.js` runs on
> `postinstall` to compile it in place.

Pipeline stages, per website:

1. **Reachability probe** — a ~4s HEAD/GET check. Unreachable hosts are
   abandoned immediately (~4s instead of ~42s burning page-load timeouts).
2. **Priority contact pages** — `/contact`, `/about`, `/imprint`, … visited
   first, since they hold most real addresses. Stops widening on the first hit.
3. **Home page** — catches addresses in headers/footers.
4. **Bounded deep crawl** — `scrapeEmailsFromWebsite` (same-domain, depth 2,
   page budget) only when nothing has been found yet.
5. **Merge → noise filter → rank** — dedupe, drop placeholder/framework
   addresses, then score: domain mailbox > freemail, and name-style locals
   outrank generic role prefixes.

Every stage is failure-isolated — a broken page never throws out of the
pipeline. The worker runs sites through a bounded pool sized by the campaign's
`email_concurrency`.

## Background scheduler

`scraper/campaignScheduler.js` runs every 60s (configurable) and is the single
driver of campaign execution — it also handles restart recovery, replacing the
old boot-only resume.

Each tick:
1. **Checks internet connectivity** (`utils/connectivity.js`). Offline → logs
   `📡 Internet unavailable` and skips the tick.
2. **Loads campaigns needing work** — `pending`/`running`, plus `failed` when
   `RESUME_FAILED=true`.
3. **Dispatches a worker** per campaign, skipping any already running.

The tick **never throws and never stops**: slow/failed DB reads, worker crashes
and connectivity loss are all logged as gentle one-liners and retried next tick.
A campaign whose worker crashes is parked as `failed` so it will not hot-loop.

## API

Base path: `/api/map-scraper`

| Method | Path | Description |
|---|---|---|
| GET | `/health` | Health check |
| GET | `/stats` | Global counters |
| GET | `/campaigns` | List campaigns |
| POST | `/campaigns` | Create + start a campaign |
| GET | `/campaigns/:id` | Campaign detail + progress + locations |
| PUT | `/campaigns/:id` | Update options; appends new locations |
| DELETE | `/campaigns/:id` | Delete campaign (cascades) |
| PATCH | `/campaigns/:id/status` | Change status |
| POST | `/campaigns/:id/start` | Start/resume the worker |
| GET | `/campaigns/:id/progress` | Progress summary |
| GET | `/campaigns/:id/results` | Scraped businesses |
| GET | `/campaigns/:id/locations` | Per-location status |
| GET | `/campaigns/:id/export` | Download results as .xlsx |

Legacy `/api/*` paths remain mounted as an alias for backwards compatibility.

## Configuration (`.env`)

| Variable | Default | Purpose |
|---|---|---|
| `PORT` | `8080` | HTTP port |
| `DATABASE_URL` | — | Full MySQL URI (takes precedence) |
| `DB_HOST` / `DB_PORT` / `DB_USER` / `DB_PASSWORD` / `DB_NAME` | localhost / 3306 / root / — / leads | Individual DB settings |
| `DB_POOL_LIMIT` | `10` | Connection pool size |
| `JSON_BODY_LIMIT` | `25mb` | Max request body (large location lists) |
| `RESUME_ON_START` | `true` | Resume interrupted campaigns on boot |
| `RESUME_FAILED` | `false` | Also retry `failed` campaigns on boot (opt-in) |
| `SCHEDULER_ENABLED` | `true` | Enable the background campaign scheduler |
| `SCHEDULER_INTERVAL_MS` | `60000` | Scheduler tick interval |
| `CONNECTIVITY_URL` | Google `generate_204` | Connectivity probe target |
| `CONNECTIVITY_TIMEOUT_MS` | `5000` | Probe timeout |

> Email research budgets (page timeout, page/depth caps, overall site budget)
> are tuned in `scraper/emailExtractor.js` under `DEFAULTS`.

## Scripts

```bash
npm start     # run the server
npm run debug # run with the inspector
npm run setup # install the Playwright Chromium browser
```
