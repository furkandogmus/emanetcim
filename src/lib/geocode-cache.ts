import type { GeocodedPlace } from "@/lib/geocode";
import { getRedis } from "@/lib/rate-limit";
import logger from "@/lib/logger";

/**
 * Mobil yer aramasi sonuc onbellegi, 24 saat. Redis varsa paylasilir (yeniden
 * baslatmada da kalir), yoksa surec ici. Isabet Nominatim'e gitmez, bu yuzden uc
 * isabette IP sinirini gevsetebilir: otel lobisinde ayni IP'yi paylasan turistler
 * cogunlukla ayni birkac yeri yaziyor.
 *
 * Yalnizca basarili (bos dahil) sonuc saklanir; Nominatim hatasi saklanirsa
 * gecici bir kesinti bir gun boyunca "bulunamadi" olarak kalirdi.
 */
const TTL_MS = 24 * 60 * 60 * 1000;
const MEMORY_MAX = 1000;
const PREFIX = "geo:v1:";

const memory = new Map<string, { at: number; places: GeocodedPlace[] }>();

/** "  Kadıköy   İskele " ile "kadıköy iskele" ayni anahtar. */
export function geocodeCacheKey(query: string, locale: string, scope: string): string {
  const q = query.normalize("NFC").trim().replace(/\s+/g, " ").toLocaleLowerCase("tr");
  return `${locale}|${scope}|${q}`;
}

export async function getCachedPlaces(key: string): Promise<GeocodedPlace[] | null> {
  const redis = getRedis();
  if (redis) {
    try {
      const raw = await redis.get(PREFIX + key);
      if (raw) return JSON.parse(raw) as GeocodedPlace[];
      return null;
    } catch (err) {
      // Redis koptuysa arama yine calisir; yalnizca onbellek atlanir.
      logger.warn({ err }, "geocode_cache_get_failed");
    }
  }
  const hit = memory.get(key);
  if (!hit) return null;
  if (Date.now() - hit.at > TTL_MS) {
    memory.delete(key);
    return null;
  }
  return hit.places;
}

export async function setCachedPlaces(key: string, places: GeocodedPlace[]): Promise<void> {
  const redis = getRedis();
  if (redis) {
    try {
      await redis.set(PREFIX + key, JSON.stringify(places), "PX", TTL_MS);
      return;
    } catch (err) {
      logger.warn({ err }, "geocode_cache_set_failed");
    }
  }
  if (memory.size >= MEMORY_MAX) {
    const oldest = memory.keys().next().value;
    if (oldest !== undefined) memory.delete(oldest);
  }
  memory.set(key, { at: Date.now(), places });
}

/** Yalnizca testler. */
export async function resetGeocodeCacheForTests(keys: string[] = []): Promise<void> {
  memory.clear();
  const redis = getRedis();
  if (redis && keys.length) await redis.del(...keys.map((k) => PREFIX + k));
}
