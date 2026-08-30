# Load tests

Stress-test harness for the capacity targets in [SCALABILITY.md](../../SCALABILITY.md).
Runs on [k6](https://k6.io) — a single binary, not an npm dependency:

```bash
brew install k6
```

## Running

Point `BASE_URL` at a **preview deployment** and pick a profile:

```bash
BASE_URL=https://cf-loadtest-preview.vercel.app npm run load:smoke
BASE_URL=... npm run load:baseline
BASE_URL=... npm run load:spike
BASE_URL=... npm run load:stress
BASE_URL=... npm run load:soak
```

If the preview has Deployment Protection on, mint a bypass token
(Vercel → Project Settings → Deployment Protection) and add
`VERCEL_BYPASS=<token>`.

Local sanity check works too: `npm run dev` then `npm run load:smoke`
(defaults to `http://localhost:3000`) — useful for harness changes, useless
for capacity numbers.

| Profile | Shape | Answers |
|---|---|---|
| `smoke` | 3 VUs, 1 min | Is the deploy + harness sane? |
| `baseline` | 20 journeys/s, 10 min | Comfortable at 1M-visitors/mo sustained peak? |
| `spike` | 5→150 journeys/s in 30s, hold 5 min | Survives a viral watch-page moment? |
| `stress` | ramp 10→300 journeys/s over 20 min | Where is the knee? (exploratory — thresholds relaxed) |
| `soak` | 30 journeys/s, 60 min | Leaks? Pool exhaustion? Drift? |

A journey ≈ 3 page requests. Pass/fail thresholds (asserted in-script):
error rate < 1%, page p95 < 800ms, checks > 99%.

The script pulls real watch/map/channel URLs from `/sitemap.xml` at start, so
the target environment must be **seeded to production shape** — thousands of
content items, dozens of channels. An empty DB produces fantasy numbers.

## Rules of engagement

1. **Never point at the production database.** Preview deployment + DB
   branch/copy, always.
2. **Watch the spend.** Dynamic pages bill per invocation — a stress run is
   real money. `smoke` is CI-safe; run the rest deliberately.
3. **Don't load-test third parties.** No Clerk sign-ins at volume, no Stripe,
   no YouTube API. Authenticated write paths (progress, comments) get
   functional tests + low-volume checks with a single session token, separately.
4. k6 measures the origin (HTML/JSON), not browser rendering — that's the
   layer we own; real-user timing comes from Vercel Speed Insights.

## Reading results

k6 prints a summary; the numbers that matter:

- `http_req_duration{kind:page}` p95 — the SLO number.
- `http_req_failed` — must stay under 1% (watch for 429/503 during spike).
- `cf_page_duration` broken out by `name` tag (home, watch, search, …) —
  identifies *which* surface degrades first. Expect `search` to be the
  slowest; it stays dynamic by design.
- For `stress`: the arrival rate at which p95 breaks 800ms is the knee —
  record it in SCALABILITY.md §4 after each run.
