import { Redis } from "@upstash/redis";

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

/**
 * Tek süreç / geliştirme ortamı için in-memory sliding window.
 * Çoklu instance veya serverless replika için `redisRateLimit` kullanın.
 */
export function rateLimitLocalMemory(
  key: string,
  max: number,
  windowMs: number
): boolean {
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

let upstash: Redis | null | undefined;

export function getUpstashRedis(): Redis | null {
  if (upstash !== undefined) return upstash;
  const url = process.env.UPSTASH_REDIS_REST_URL?.trim();
  const token = process.env.UPSTASH_REDIS_REST_TOKEN?.trim();
  if (!url || !token) {
    upstash = null;
    return null;
  }
  upstash = new Redis({ url, token });
  return upstash;
}

/**
 * Dağıtık rate limit: `UPSTASH_REDIS_REST_URL` + `UPSTASH_REDIS_REST_TOKEN` tanımlıysa Upstash Redis kullanılır.
 * Aksi halde in-memory `rateLimitLocalMemory` ile düşer.
 */
async function redisRateLimit(
  key: string,
  max: number,
  windowMs: number
): Promise<boolean> {
  const redis = getUpstashRedis();
  if (!redis) {
    const canFallbackToMemory =
      process.env.NODE_ENV !== "production" ||
      process.env.REQUIRE_DISTRIBUTED_RATE_LIMIT?.trim() === "false";
    if (!canFallbackToMemory) {
      throw new Error(
        "Distributed rate limit is required in production. Configure Upstash or set REQUIRE_DISTRIBUTED_RATE_LIMIT=false explicitly.",
      );
    }
    return rateLimitLocalMemory(key, max, windowMs);
  }
  const now = Date.now();
  const windowId = Math.floor(now / windowMs);
  const redisKey = `rl:v1:${key}:${windowId}`;
  const count = await redis.incr(redisKey);
  if (count === 1) {
    await redis.pexpire(redisKey, windowMs);
  }
  return count <= max;
}

/**
 * Rate limit (async). Üretimde çoklu instance için Upstash Redis env değişkenlerini ayarlayın.
 */
export async function rateLimit(
  key: string,
  max: number,
  windowMs: number
): Promise<boolean> {
  return redisRateLimit(key, max, windowMs);
}
