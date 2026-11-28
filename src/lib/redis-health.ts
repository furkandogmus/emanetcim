import type Redis from "ioredis";
import { getRedis } from "@/lib/rate-limit";
import { withTimeout } from "@/lib/async-timeout";

/**
 * Redis BELLEK SAGLIGI: hiz siniri sayaclari ve mobil oturum yenileme kayitlari
 * (`refresh-token-store.ts`) Redis'te ve Redis kalici degil.
 *
 * NEDEN (2026-11-28): Redis 64 MB ve `allkeys-lru` ile calisiyordu. Bellek
 * dolunca en az kullanilan anahtarlar sessizce silinir; en az kullanilanlar da
 * tam olarak oturum yenileme kayitlaridir (bir kez yazilir, bir daha okunmaz,
 * 30 gune kadar yasar). Silinen kayit, calinmis bir yenileme token'inin tekrar
 * kullanimini "ilk kullanim" gibi gosterir. Yerel olcum: 12 MB sinirda 40 bin
 * kaydin 26 bini `allkeys-lru` ile silindi, `volatile-ttl` ile hicbiri.
 *
 * Bu kontrol hicbir yerde gorunmeyen bu durumu `/api/health/jobs`'a tasir:
 *   - `broken`: Redis acildigindan beri anahtar bosaltti ya da bellek %90 dolu.
 *   - `warning`: %75 dolu, beklenen politika degil ya da suresiz anahtar var
 *     (`volatile-ttl` suresiz anahtari hic bosaltmaz). Sagligi bozmaz, loglanir.
 *   - `unknown`: INFO okunamadi. Redis'in kendisi `/api/health`'in isi.
 */

export const REDIS_EXPECTED_POLICY = "volatile-ttl";
export const REDIS_WARN_RATIO = 0.75;
export const REDIS_BROKEN_RATIO = 0.9;
const INFO_TIMEOUT_MS = 2_000;

export type RedisMemoryStatus = "ok" | "warning" | "broken" | "not_configured" | "unknown";

export type RedisMemoryCheck = {
  status: RedisMemoryStatus;
  reasons: string[];
  usedBytes?: number;
  maxBytes?: number;
  usageRatio?: number;
  policy?: string;
  evictedKeys?: number;
  keys?: number;
  keysWithoutTtl?: number;
};

/** `INFO` ciktisi -> `alan: deger`. Bolum basliklari (`# Memory`) atlanir. */
export function parseRedisInfo(raw: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const line of raw.split(/\r?\n/)) {
    if (!line || line.startsWith("#")) continue;
    const i = line.indexOf(":");
    if (i > 0) out[line.slice(0, i)] = line.slice(i + 1).trim();
  }
  return out;
}

/** `db0:keys=12,expires=11,avg_ttl=...` satirlarinin toplami. */
function keyspaceTotals(info: Record<string, string>): { keys: number; expires: number } {
  let keys = 0;
  let expires = 0;
  for (const [field, value] of Object.entries(info)) {
    if (!/^db\d+$/.test(field)) continue;
    keys += Number(/keys=(\d+)/.exec(value)?.[1] ?? 0);
    expires += Number(/expires=(\d+)/.exec(value)?.[1] ?? 0);
  }
  return { keys, expires };
}

export function evaluateRedisMemory(info: Record<string, string>): RedisMemoryCheck {
  const usedBytes = Number(info.used_memory ?? NaN);
  const maxBytes = Number(info.maxmemory ?? NaN);
  const evictedKeys = Number(info.evicted_keys ?? 0);
  const policy = info.maxmemory_policy;
  const { keys, expires } = keyspaceTotals(info);
  const keysWithoutTtl = Math.max(0, keys - expires);

  if (!Number.isFinite(usedBytes) || !Number.isFinite(maxBytes)) {
    return { status: "unknown", reasons: ["info_incomplete"] };
  }

  const reasons: string[] = [];
  let status: RedisMemoryStatus = "ok";
  const usageRatio = maxBytes > 0 ? usedBytes / maxBytes : undefined;

  if (evictedKeys > 0) {
    status = "broken";
    reasons.push("keys_evicted");
  }
  if (usageRatio !== undefined && usageRatio >= REDIS_BROKEN_RATIO) {
    status = "broken";
    reasons.push("memory_near_limit");
  } else if (usageRatio !== undefined && usageRatio >= REDIS_WARN_RATIO) {
    if (status === "ok") status = "warning";
    reasons.push("memory_high");
  }
  // Sinirsiz Redis bellegi konteyner sinirina kadar buyur ve cekirdek onu oldurur.
  if (maxBytes === 0) {
    if (status === "ok") status = "warning";
    reasons.push("no_maxmemory");
  }
  if (policy && policy !== REDIS_EXPECTED_POLICY) {
    if (status === "ok") status = "warning";
    reasons.push("unexpected_policy");
  }
  if (keysWithoutTtl > 0) {
    if (status === "ok") status = "warning";
    reasons.push("keys_without_ttl");
  }

  return {
    status,
    reasons,
    usedBytes,
    maxBytes,
    ...(usageRatio !== undefined ? { usageRatio: Math.round(usageRatio * 1000) / 1000 } : {}),
    policy,
    evictedKeys,
    keys,
    keysWithoutTtl,
  };
}

export async function checkRedisMemory(redis: Redis | null = getRedis()): Promise<RedisMemoryCheck> {
  if (!redis) return { status: "not_configured", reasons: [] };
  try {
    const raw = await withTimeout(redis.info(), INFO_TIMEOUT_MS, "redis_info");
    return evaluateRedisMemory(parseRedisInfo(raw));
  } catch {
    return { status: "unknown", reasons: ["info_failed"] };
  }
}
