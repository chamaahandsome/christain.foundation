// A small fixed-window rate limiter, held in memory.
//
// It guards surfaces open to anyone — booking requests above all, where
// the sign-in wall used to do this job. Memory means it is per server
// instance and resets on deploy: enough to stop a script hammering one
// creator, not a substitute for a shared store if CF ever runs wide.

interface Window {
  count: number;
  resetAt: number;
}

const buckets = new Map<string, Map<string, Window>>();

export interface RateLimitResult {
  allowed: boolean;
  /** requests still available in this window */
  remaining: number;
  resetAt: number;
}

/** Count one hit against `key` in `bucket`, and say whether it passes. */
export function rateLimit(
  bucket: string,
  key: string,
  options: { limit: number; windowMs: number; now?: number },
): RateLimitResult {
  const now = options.now ?? Date.now();
  let windows = buckets.get(bucket);
  if (!windows) {
    windows = new Map();
    buckets.set(bucket, windows);
  }

  // Sweep anything long expired so a busy day can't grow the map forever.
  if (windows.size > 5_000) {
    for (const [k, w] of windows) if (w.resetAt <= now) windows.delete(k);
  }

  const current = windows.get(key);
  if (!current || current.resetAt <= now) {
    const fresh = { count: 1, resetAt: now + options.windowMs };
    windows.set(key, fresh);
    return { allowed: true, remaining: options.limit - 1, resetAt: fresh.resetAt };
  }

  current.count += 1;
  return {
    allowed: current.count <= options.limit,
    remaining: Math.max(options.limit - current.count, 0),
    resetAt: current.resetAt,
  };
}

/** Forget a bucket — tests, and nothing else. */
export function resetRateLimit(bucket?: string): void {
  if (bucket) buckets.delete(bucket);
  else buckets.clear();
}

/** Guest booking requests: the Maltivas allowance, 3 per 5 minutes per IP. */
export function allowGuestRequest(ip: string | null, now?: number): boolean {
  // No IP to key on (a proxy stripped the headers) — let it through rather
  // than lump every anonymous visitor into one bucket.
  if (!ip) return true;
  return rateLimit("guest-booking", ip, {
    limit: 3,
    windowMs: 5 * 60_000,
    now,
  }).allowed;
}
