# Scalability & Load Testing

**Goal:** serve 100K–1M monthly visitors without degradation, and prove it with a
repeatable stress-test harness (`tests/load/`) instead of hoping.

Companion to PLAN.md §5 (stack) and §8 (cross-cutting). This document is the
authority on capacity posture: targets, known bottlenecks, the fix phases, and
the testing system that gates each readiness level.

---

## 1. Capacity model — what 1M visitors actually means

Monthly totals are the vanity number; **peak request rate** is what breaks sites.

| | 100K visitors/mo | 1M visitors/mo |
|---|---|---|
| Pageviews (~4/visit) | ~400K/mo | ~4M/mo |
| Average pageviews/sec | ~0.15/s | ~1.5/s |
| Sustained peak (20× avg, evening/Sunday) | ~3/s | ~30/s |
| Viral spike (one watch/map page shared widely) | ~100/s | ~500/s |

**Design targets** (what the load harness asserts):

- Sustain **100 pageviews/sec** indefinitely, p95 TTFB < 800ms, error rate < 1%.
- Absorb a **500 pageviews/sec spike** for 5+ minutes without errors climbing.
- Hold a 30/s **soak for an hour** with no drift (leaks, pool exhaustion, cost runaway).

These targets cover 1M/mo with margin; 100K/mo passes them trivially.

## 2. What already scales for free

The embed-first architecture is the single biggest scaling decision, already made:

- **Video bandwidth is YouTube's problem** — the iframe player streams from
  Google, thumbnails come from `i.ytimg.com`. Our per-pageview payload is HTML +
  a little JSON. This is why 1M visitors is feasible on a small stack at all.
- **Vercel autoscales compute** — serverless functions scale horizontally with
  no ops work; static assets and `next/image` output sit on the CDN.
- **Clerk, Stripe, Trickl** scale on their side; we only handle webhooks.

## 3. Bottlenecks, ranked (what breaks first)

### 3.1 Every public page is `force-dynamic` — the big one

Home, `/watch/[id]`, `/explore`, `/map`, `/map/[slug]`, `/channel/[handle]`,
`/search`, `/feed`, `/books` all declare `export const dynamic = "force-dynamic"`.
Every pageview is a function invocation running 2–5 Prisma queries. At a 500/s
spike that is **1,000–2,500 queries/sec into one MySQL database** — it will
saturate connections and fall over. It's also the cost driver: 4M invocations/mo
that could mostly be CDN hits.

**Fix (Phase A): ISR + cache tags.** Public pages are the same for everyone —
the per-user parts are small and separable:

- Replace `force-dynamic` with `export const revalidate = 60` (home/explore/map/
  channel; watch pages can take 300s) so the CDN serves cached HTML and the DB
  sees ~1 render per page per minute **regardless of traffic**.
- Move the only per-user bit on hot pages — continue-watching resume position on
  `/watch` — to a small client-side fetch after hydration (the player already
  posts progress from the client; reading it the same way is symmetric).
- Tag caches (`revalidateTag`) and invalidate on the events that change them:
  studio publish/edit, admin curation/shelves, embed-check cron marking items
  unavailable. Freshness stays event-driven, not TTL-bound.
- `/search` stays dynamic (query-specific) — it gets rate limiting instead (§3.4).

This one phase converts the read path from "scales with traffic" to "scales with
content-change rate," which is the whole ballgame.

### 3.2 Database connections under serverless

Prisma per-function + horizontal scaling = connection storms during spikes.
MySQL with `relationMode = "prisma"` implies a serverless-friendly provider —
**confirm the production `DATABASE_URL` goes through a pooler** (PlanetScale's
built-in edge pool, or Prisma Accelerate). Keep `connection_limit=1` per
function. After Phase A this is defense-in-depth rather than the front line,
but an unpooled direct connection will fail a spike test even with ISR (search,
API writes, revalidations still hit the DB).

Also audit indexes on the hot queries: `ContentItem(channelId, visibility,
publishedAt)`, `ContentItem(visibility, unavailableAt, publishedAt)`, the
FULLTEXT index for search, `WatchProgress(userId, contentItemId)` (exists as the
compound unique).

### 3.3 Write hot paths

- **`/api/progress`** — fires periodically from every signed-in player and does
  **two** queries per beacon (existence check, then upsert). Drop the pre-check:
  attempt the upsert and catch the FK/unknown-item error. Throttle the client
  beacon (≥15s between posts, plus on pause/unload via `sendBeacon`).
- **`/api/log`** — unauthenticated, no rate limit: a log-flood/DoS vector and,
  on Vercel, a billable one. Rate limit per IP (§3.4) and cap acceptance.
- **Comments / follow / report** — authenticated but unthrottled; rate limit.

### 3.4 No rate limiting anywhere

Add Upstash Redis + `@upstash/ratelimit` (fits the Vercel/serverless model;
PLAN §5 already earmarks Redis). Sliding-window limits on: all POST APIs
(progress, comments, follow, report, apply, log) and `/search`. Return 429 with
`Retry-After`. This is also the abuse story, not just the scale story.

### 3.5 Middleware breadth

`clerkMiddleware` runs on every non-asset route, including fully public pages.
JWT verification is cheap and edge-executed, so this is a cost/latency trim,
not a stability risk: once Phase A lands, cached public pages skip functions
entirely, which mostly resolves it. Keep the matcher tight as routes grow.

### 3.6 Search at 1M scale (later)

MySQL FULLTEXT is fine to hundreds of thousands of rows and current query
volume once rate-limited. If search becomes a primary surface or the library
passes ~500K items, lift it into Meilisearch/Typesense. Not a v1 blocker —
monitor `search` p95 in the soak runs.

## 4. Fix phases and readiness gates

| Phase | Work | Gate (harness profile that must pass) |
|---|---|---|
| **A — Cache the read path** | ISR + cache tags on public pages; client-side resume fetch; CDN headers on public GET APIs | `baseline` + `spike` against a prod-shaped preview |
| **B — Pool & protect** | Verified pooled `DATABASE_URL`; Upstash rate limits on writes + search; `/api/progress` single-query + client throttle; `/api/log` capped | `stress` (find the knee, document it) |
| **C — Observe & operate** | Sentry (errors), Vercel Speed Insights + Analytics, DB metrics dashboard, alerts on SLO burn; monthly `soak` | `soak` 60min clean |
| **1M+ (as needed)** | Search engine extraction; read replica; edge-cache search suggestions | re-run full ladder |

**Readiness levels:**

- **100K/mo ready** = Phase A shipped, `smoke` + `baseline` green.
- **Viral-moment ready** = Phase B shipped, `spike` green (500/s, 5 min).
- **1M/mo ready** = Phase C shipped, `stress` knee documented ≥ 2× spike target,
  `soak` green, alerting live.

**SLOs** (what alerts fire on): public-page p95 TTFB < 800ms, availability
99.9% monthly, API write p95 < 400ms, error rate < 0.5%.

## 5. The load-testing system (`tests/load/`)

[k6](https://k6.io) (Grafana's load tool, single Go binary: `brew install k6`).
One parameterized script, five profiles:

| Profile | Shape | Purpose | Cadence |
|---|---|---|---|
| `smoke` | 3 VUs, 1 min | Harness + deploy sanity | every run first |
| `baseline` | 20 journeys/s, 10 min (~60 req/s) | 1M/mo sustained-peak comfort | per phase gate |
| `spike` | 5 → 150 journeys/s in 30s, hold 5 min | Viral watch-page moment | per phase gate |
| `stress` | ramp 10 → 300 journeys/s over 20 min | Find the knee; capacity headroom number | Phase B, then quarterly |
| `soak` | 30 journeys/s, 60 min | Leaks, pool exhaustion, cost drift | monthly + pre-launch |

A **journey** is a realistic visit (~3 page requests): browse (home → explore →
watch), seeker (map → question → watch), search, or channel visit — weighted.
The script discovers real watch/map/channel URLs from `/sitemap.xml` at start,
so it exercises genuine content, not synthetic paths.

Thresholds are asserted in-script (run fails loudly): error rate < 1%,
p95 < 800ms, checks > 99%.

```bash
npm run load:smoke      # BASE_URL=https://<preview>.vercel.app
npm run load:baseline   # …and: load:spike, load:stress, load:soak
```

**Rules of engagement** (also in `tests/load/README.md`):

1. **Never against the production database.** Use a dedicated preview
   deployment on a DB branch/copy seeded to production shape (thousands of
   content items, realistic channels) — an empty DB gives fantasy numbers.
2. **Watch the spend.** Until Phase A lands, every request is a billable
   invocation — a 20-minute stress run is real money. Run stress/soak
   deliberately, not in CI. (`smoke` is CI-safe.)
3. **Don't load-test third parties.** No authenticated flows at volume (Clerk
   rate limits and ToS), no Stripe, no YouTube API. Authenticated write paths
   get functional tests plus low-volume checks with a single session token.
4. k6 doesn't execute JS or load iframes — it measures **our origin**, which is
   exactly the layer we own. Real-user rendering is covered by Speed Insights.
