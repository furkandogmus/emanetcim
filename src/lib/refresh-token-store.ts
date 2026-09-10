import { getRedis } from "./rate-limit";

/**
 * Refresh token TEKRAR KULLANIM (replay) tespiti.
 *
 * NEDEN VAR (2026-09-10'da bulundu): `/api/mobile/auth/refresh` gecerli bir
 * refresh token'a karsilik yeni bir cift basiyordu ama SUNULAN token'i hicbir
 * sekilde gecersiz kilmiyordu -- token stateless JWT, gecerliligi yalniz
 * `tokenVersion` karsilastirmasina bagliydi. Ayni refresh token'in hem mesru
 * cihaz hem de onu ele gecirmis bir saldirgan tarafindan PARALEL/TEKRAR TEKRAR
 * kullanilmasi (sektor standardi "refresh token reuse detection" ile normalde
 * TUM aileyi iptal edecek bir durum) hicbir alarma yol acmiyordu.
 *
 * Her refresh token'a bir `jti` verilir; ilk kullanildiginda burada
 * ISARETLENIR (TTL = token'in kalan omru). Ayni `jti` ikinci kez gelirse
 * REPLAY'dir -- cagiran taraf (`refresh/route.ts`) bunu `tokenVersion`i
 * artirarak TUM aileyi (o kullanicinin tum access/refresh token'larini) iptal
 * etmek icin kullanir.
 */

const memoryStore = new Map<string, number>();
let lastSweep = 0;
const SWEEP_INTERVAL_MS = 60_000;

function sweepMemoryStore(now: number) {
  if (now - lastSweep < SWEEP_INTERVAL_MS) return;
  lastSweep = now;
  for (const [key, expiresAt] of memoryStore.entries()) {
    if (expiresAt <= now) memoryStore.delete(key);
  }
}

/**
 * `jti`yi ilk kez kullanilmis olarak isaretlemeyi DENER.
 *
 * Doner `true`: bu ilk kullanim, devam edilebilir.
 * Doner `false`: bu `jti` DAHA ONCE kullanilmis -- replay.
 */
export async function claimRefreshJti(jti: string, ttlMs: number): Promise<boolean> {
  if (!jti || ttlMs <= 0) return true; // ttl gecmisse zaten dogal olarak reddedilecek (exp kontrolu once calisir).

  const redis = getRedis();
  if (redis) {
    const key = `rtjti:v1:${jti}`;
    const res = await redis.set(key, "1", "PX", ttlMs, "NX");
    return res === "OK";
  }

  const now = Date.now();
  sweepMemoryStore(now);
  const key = `rtjti:${jti}`;
  if (memoryStore.has(key) && memoryStore.get(key)! > now) return false;
  memoryStore.set(key, now + ttlMs);
  return true;
}
