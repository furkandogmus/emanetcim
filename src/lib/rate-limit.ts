import Redis from "ioredis";

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

let redisClient: Redis | null | undefined;

/**
 * `REDIS_URL` tanımlıysa doğrudan Redis bağlantısı (ioredis).
 *
 * NEDEN DEĞİŞTİ (2026-08-22): Redis'in tek kullanımı bu dosyadaki
 * `INCR` + `PEXPIRE`. Buna rağmen istemci `@upstash/redis` idi ve kendi
 * sunucumuzdaki Redis'e `serverless-redis-http` (srh) adlı bir HTTP vekili
 * üzerinden bağlanıyordu — fazladan bir konteyner, fazladan bir ağ atlaması ve
 * canlıda OOM-kill (137) yaşamış bir süreç, iki Redis komutu için.
 * Upstash'e taşınma planı yok; olursa ioredis `rediss://` URL'siyle de çalışır.
 */
export function getRedis(): Redis | null {
  if (redisClient !== undefined) return redisClient;
  const url = process.env.REDIS_URL?.trim();
  if (!url) {
    redisClient = null;
    return null;
  }
  /**
   * `lazyConnect` + `enableOfflineQueue: false` BİRLİKTE kullanılmaz: ilk komut
   * bağlantı kurulmadan gelir ve anında reddedilir — canlıda `/api/health`
   * `redis: error` dedi, giriş rate limit'i de aynı yoldan patlardı
   * (2026-08-22 AWS provası). Bağlantı hemen açılır; kopukken komutlar kısa
   * kuyrukta bekler, `maxRetriesPerRequest: 1` ile hızlı hata verir.
   */
  redisClient = new Redis(url, {
    maxRetriesPerRequest: 1,
    connectTimeout: 3_000,
  });
  redisClient.on("error", () => {
    /* bağlantı hataları çağıranın try/catch'inde ele alınır; süreç düşmesin */
  });
  return redisClient;
}

/**
 * Dağıtık rate limit: `REDIS_URL` tanımlıysa Redis kullanılır.
 * Aksi halde in-memory `rateLimitLocalMemory` ile düşer.
 */
async function redisRateLimit(
  key: string,
  max: number,
  windowMs: number
): Promise<boolean> {
  const redis = getRedis();
  if (!redis) {
    const canFallbackToMemory =
      process.env.NODE_ENV !== "production" ||
      process.env.REQUIRE_DISTRIBUTED_RATE_LIMIT?.trim() === "false";
    if (!canFallbackToMemory) {
      throw new Error(
        "Distributed rate limit is required in production. Set REDIS_URL or set REQUIRE_DISTRIBUTED_RATE_LIMIT=false explicitly.",
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
 * Rate limit (async). Üretimde `REDIS_URL` ayarlayın.
 */
export async function rateLimit(
  key: string,
  max: number,
  windowMs: number
): Promise<boolean> {
  return redisRateLimit(key, max, windowMs);
}
