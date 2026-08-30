// CF load-test harness (k6 — https://k6.io, `brew install k6`).
// One script, five profiles; see SCALABILITY.md §5 and tests/load/README.md.
//
//   k6 run -e BASE_URL=https://<preview>.vercel.app -e PROFILE=smoke tests/load/cf-load.js
//
// A "journey" is one realistic visit (~3 page requests), weighted across the
// site's real entry points. Watch/map/channel URLs are discovered from
// /sitemap.xml at start so the test exercises genuine content.

import http from "k6/http";
import { check, sleep } from "k6";
import { Trend } from "k6/metrics";

const BASE_URL = (__ENV.BASE_URL || "http://localhost:3000").replace(/\/$/, "");
const PROFILE = __ENV.PROFILE || "smoke";

// Vercel preview protection: pass -e VERCEL_BYPASS=<token> to send the
// x-vercel-protection-bypass header (Project Settings → Deployment Protection).
const PARAMS = __ENV.VERCEL_BYPASS
  ? { headers: { "x-vercel-protection-bypass": __ENV.VERCEL_BYPASS } }
  : {};

// ---------------------------------------------------------------------------
// Profiles (journeys/sec; each journey ≈ 3 requests). SCALABILITY.md §5.
// ---------------------------------------------------------------------------
const PROFILES = {
  smoke: {
    executor: "constant-vus",
    vus: 3,
    duration: "1m",
  },
  baseline: {
    executor: "constant-arrival-rate",
    rate: 20,
    timeUnit: "1s",
    duration: "10m",
    preAllocatedVUs: 60,
    maxVUs: 200,
  },
  spike: {
    executor: "ramping-arrival-rate",
    startRate: 5,
    timeUnit: "1s",
    preAllocatedVUs: 200,
    maxVUs: 600,
    stages: [
      { target: 5, duration: "1m" }, // calm before
      { target: 150, duration: "30s" }, // the share goes out
      { target: 150, duration: "5m" }, // hold the viral moment
      { target: 5, duration: "1m" }, // recovery
    ],
  },
  stress: {
    executor: "ramping-arrival-rate",
    startRate: 10,
    timeUnit: "1s",
    preAllocatedVUs: 300,
    maxVUs: 1000,
    stages: [
      { target: 50, duration: "4m" },
      { target: 100, duration: "4m" },
      { target: 200, duration: "6m" },
      { target: 300, duration: "6m" },
    ],
  },
  soak: {
    executor: "constant-arrival-rate",
    rate: 30,
    timeUnit: "1s",
    duration: "60m",
    preAllocatedVUs: 100,
    maxVUs: 300,
  },
};

if (!PROFILES[PROFILE]) {
  throw new Error(
    `Unknown PROFILE "${PROFILE}" — expected one of: ${Object.keys(PROFILES).join(", ")}`,
  );
}

export const options = {
  scenarios: { [PROFILE]: { ...PROFILES[PROFILE], exec: "journey" } },
  thresholds: {
    // SCALABILITY.md §1 design targets — the run FAILS if these break.
    http_req_failed: ["rate<0.01"],
    "http_req_duration{kind:page}": ["p(95)<800"],
    checks: ["rate>0.99"],
  },
  // Stress is exploratory: let it run past thresholds to find the knee.
  ...(PROFILE === "stress" ? { thresholds: { checks: ["rate>0"] } } : {}),
};

const pageTrend = new Trend("cf_page_duration", true);

// ---------------------------------------------------------------------------
// setup(): discover real URLs from the sitemap. Runs once; result is handed
// to every VU. The sitemap advertises the canonical host — rewrite each URL's
// origin onto BASE_URL so previews get tested, not production.
// ---------------------------------------------------------------------------
export function setup() {
  const res = http.get(`${BASE_URL}/sitemap.xml`, PARAMS);
  const pools = { watch: [], map: [], channel: [], start: [] };
  if (res.status === 200) {
    const locs = String(res.body).match(/<loc>([^<]+)<\/loc>/g) || [];
    for (const tag of locs) {
      const path = tag.replace(/<\/?loc>/g, "").replace(/^https?:\/\/[^/]+/, "");
      if (path.startsWith("/watch/")) pools.watch.push(path);
      else if (path.startsWith("/map/")) pools.map.push(path);
      else if (path.startsWith("/@")) pools.channel.push(path);
      else if (path.startsWith("/start/")) pools.start.push(path);
    }
  }
  console.log(
    `[setup] sitemap pools — watch:${pools.watch.length} map:${pools.map.length} ` +
      `channel:${pools.channel.length} start:${pools.start.length}`,
  );
  return pools;
}

function page(path, name) {
  const res = http.get(`${BASE_URL}${path}`, {
    ...PARAMS,
    tags: { kind: "page", name },
  });
  check(res, { [`${name} 200`]: (r) => r.status === 200 });
  pageTrend.add(res.timings.duration, { name });
  return res;
}

function pick(pool, fallback) {
  if (!pool || pool.length === 0) return fallback;
  return pool[Math.floor(Math.random() * pool.length)];
}

const SEARCH_TERMS = [
  "prayer",
  "gospel",
  "baptism",
  "grace",
  "romans",
  "faith and works",
  "holy spirit",
];

// ---------------------------------------------------------------------------
// Journeys — weighted mix of how people actually arrive and move.
// ---------------------------------------------------------------------------
export function journey(pools) {
  const roll = Math.random();

  if (roll < 0.35) {
    // Browser: front door → explore → a video.
    page("/", "home");
    sleep(1);
    page("/explore", "explore");
    sleep(1);
    if (pools.watch.length) page(pick(pools.watch), "watch");
  } else if (roll < 0.6) {
    // Direct/viral: lands straight on a shared watch page, maybe one more.
    page(pick(pools.watch, "/"), "watch");
    sleep(2);
    if (Math.random() < 0.5 && pools.watch.length)
      page(pick(pools.watch), "watch");
  } else if (roll < 0.8) {
    // Seeker: the doctrinal map → a question → a video.
    page("/map", "map-index");
    sleep(1);
    if (pools.map.length) {
      page(pick(pools.map), "map-question");
      sleep(1);
    }
    if (pools.watch.length) page(pick(pools.watch), "watch");
  } else if (roll < 0.92) {
    // Searcher — /search stays dynamic in every phase, so it earns real load.
    const q = SEARCH_TERMS[Math.floor(Math.random() * SEARCH_TERMS.length)];
    page(`/search?q=${encodeURIComponent(q)}`, "search");
  } else {
    // Channel visit: a creator's page → one of their videos.
    page(pick(pools.channel, "/explore"), "channel");
    sleep(1);
    if (pools.watch.length) page(pick(pools.watch), "watch");
  }
}
