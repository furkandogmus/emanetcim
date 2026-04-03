const buckets = new Map<string, number[]>();

const MAX_RETENTION_MS = 5 * 60 * 1000;
let lastSweep = 0;
const SWEEP_INTERVAL_MS = 60_000;

function sweepStaleKeys(now: number) {
  if (now - lastSweep < SWEEP_INTERVAL_MS || buckets.size === 0) return;
  lastSweep = now;
  for (const [key, times] of buckets.entries()) {
    const fresh = times.filter((t) => now - t < MAX_RETENTION_MS);
    if (fresh.length === 0) buckets.delete(key);
    else buckets.set(key, fresh);
  }
}

export function rateLimit(key: string, max: number, windowMs: number): boolean {
  const now = Date.now();
  sweepStaleKeys(now);

  const prev = buckets.get(key) ?? [];
  const fresh = prev.filter((t) => now - t < windowMs);
  if (fresh.length >= max) {
    buckets.set(key, fresh);
    return false;
  }
  fresh.push(now);
  buckets.set(key, fresh);
  return true;
}
