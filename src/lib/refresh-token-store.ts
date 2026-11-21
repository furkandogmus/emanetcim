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
 * ISARETLENIR (deger = ilk kullanim ani, TTL = token'in kalan omru).
 *
 * TOLERANS PENCERESI (2026-11-21): eskiden ayni `jti`nin IKINCI gorulmesi
 * dogrudan replay sayiliyordu. Oysa sunucu cifti basip yanit kayboldugunda
 * (12 sn istemci zaman asimi, dolasimdaki turist, uygulama arka plana atildi,
 * deploy sirasinda yeniden baslayan surec) mesru istemci ESKI token'la tekrar
 * gelir; sunucu bunu replay sanip kullanicinin TUM cihazlarini ve web
 * oturumunu dusuruyordu. Artik ilk kullanimda basilan cift `REFRESH_GRACE_MS`
 * boyunca saklanir; pencere icindeki tekrar AYNI cifti alir (idempotent).
 * Aile yalnizca pencere DISINDAKI tekrar kullanimda iptal edilir.
 *
 * HALEF KONTROLU: cift, halef refresh token'in `jti`siyle (`nextJti`) saklanir.
 * Pencere icindeki tekrarda halef ZATEN kullanildiysa bu kayip yanit olamaz (mesru
 * istemci halefi aldi ve kullandi): replay sayilir, aile iptal edilir. Yaniti
 * gercekten kaybolan istemci halefi hic kullanmamistir, ona maliyeti yok.
 */

/** Ayni refresh token'in tekrarina ayni ciftin donuldugu sure. */
export const REFRESH_GRACE_MS = 60_000;

export type IssuedPair = { accessToken: string; refreshToken: string };

export type RefreshClaim =
  /** Ilk kullanim: yeni cift basilir, `rememberIssuedPair` ile saklanir. */
  | { kind: "first" }
  /** Pencere icinde tekrar: daha once basilan cift aynen doner. */
  | { kind: "repeat"; pair: IssuedPair }
  /** Pencere icinde tekrar ama ilk istegin cifti henuz yazilmadi (eszamanli). */
  | { kind: "pending" }
  /** Pencere disinda tekrar: replay, aile iptal edilir. */
  | { kind: "reused" };

type MemoryEntry = { value: string; expiresAt: number };
const memoryStore = new Map<string, MemoryEntry>();
let lastSweep = 0;
const SWEEP_INTERVAL_MS = 60_000;

function sweepMemoryStore(now: number) {
  if (now - lastSweep < SWEEP_INTERVAL_MS) return;
  lastSweep = now;
  for (const [key, entry] of memoryStore.entries()) {
    if (entry.expiresAt <= now) memoryStore.delete(key);
  }
}

function memoryGet(key: string, now: number): string | null {
  const entry = memoryStore.get(key);
  if (!entry || entry.expiresAt <= now) return null;
  return entry.value;
}

const claimKey = (jti: string) => `rtjti:v1:${jti}`;
const pairKey = (jti: string) => `rtpair:v1:${jti}`;

/** `issuedAt`: pencere bu ana gore olculur; Redis TTL tek basina yetmez (testte sahte saat, saat kaymasi). */
type StoredPair = { pair: IssuedPair; nextJti: string | null; issuedAt: number | null };

function parsePair(raw: string | null): StoredPair | null {
  if (!raw) return null;
  try {
    const p = JSON.parse(raw) as Partial<IssuedPair> & { nextJti?: unknown; issuedAt?: unknown };
    return typeof p.accessToken === "string" && typeof p.refreshToken === "string"
      ? {
          pair: { accessToken: p.accessToken, refreshToken: p.refreshToken },
          nextJti: typeof p.nextJti === "string" && p.nextJti ? p.nextJti : null,
          issuedAt: typeof p.issuedAt === "number" ? p.issuedAt : null,
        }
      : null;
  } catch {
    return null;
  }
}

/**
 * Ilk kullanim aninin degeri; eski "1" degerli kayit pencere disi sayilir.
 * `successorUsed`: saklanan ciftin halef jti'si zaten kullanilmis mi.
 */
function classifyRepeat(
  claimedAt: string | null,
  stored: StoredPair | null,
  successorUsed: boolean,
  now: number,
): RefreshClaim {
  const inWindow = stored && (stored.issuedAt === null || now - stored.issuedAt < REFRESH_GRACE_MS);
  if (stored && inWindow) return successorUsed ? { kind: "reused" } : { kind: "repeat", pair: stored.pair };
  const at = Number(claimedAt);
  if (Number.isFinite(at) && now - at < REFRESH_GRACE_MS) return { kind: "pending" };
  return { kind: "reused" };
}

/**
 * `jti`yi ilk kez kullanilmis olarak isaretlemeyi DENER. Redis hatasi
 * FIRLATILIR: cagiran 503 doner, istemci oturumu korur.
 */
export async function claimRefreshJti(
  jti: string,
  ttlMs: number,
  now: number = Date.now(),
): Promise<RefreshClaim> {
  if (!jti || ttlMs <= 0) return { kind: "first" }; // ttl gecmisse zaten dogal olarak reddedilecek (exp kontrolu once calisir).

  const redis = getRedis();
  if (redis) {
    const res = await redis.set(claimKey(jti), String(now), "PX", ttlMs, "NX");
    if (res === "OK") return { kind: "first" };
    const [pairRaw, claimedAt] = await Promise.all([redis.get(pairKey(jti)), redis.get(claimKey(jti))]);
    const stored = parsePair(pairRaw);
    const successorUsed = stored?.nextJti ? (await redis.exists(claimKey(stored.nextJti))) > 0 : false;
    return classifyRepeat(claimedAt, stored, successorUsed, now);
  }

  sweepMemoryStore(now);
  const existing = memoryGet(claimKey(jti), now);
  if (existing === null) {
    memoryStore.set(claimKey(jti), { value: String(now), expiresAt: now + ttlMs });
    return { kind: "first" };
  }
  const stored = parsePair(memoryGet(pairKey(jti), now));
  const successorUsed = stored?.nextJti ? memoryGet(claimKey(stored.nextJti), now) !== null : false;
  return classifyRepeat(existing, stored, successorUsed, now);
}

/**
 * Ilk kullanimda basilan cifti, halef refresh token'in jti'siyle birlikte pencere
 * boyunca saklar. Hata FIRLATILIR: cagiran `releaseRefreshJti` ile isareti geri alir.
 */
export async function rememberIssuedPair(
  jti: string,
  pair: IssuedPair,
  nextJti: string,
  now: number = Date.now(),
): Promise<void> {
  const value = JSON.stringify({ ...pair, nextJti, issuedAt: now });
  const redis = getRedis();
  if (redis) {
    await redis.set(pairKey(jti), value, "PX", REFRESH_GRACE_MS);
    return;
  }
  memoryStore.set(pairKey(jti), { value, expiresAt: now + REFRESH_GRACE_MS });
}

/**
 * Cift saklanamadiysa ilk-kullanim isaretini geri alir: istemci ayni token'la tekrar
 * geldiginde yine ilk kullanim sayilir. Yoksa 60 sn `pending` (503), ardindan
 * `reused` ve butun cihazlarin oturumu duserdi. En iyi caba: hata yutulur.
 */
export async function releaseRefreshJti(jti: string): Promise<void> {
  const redis = getRedis();
  if (redis) {
    await redis.del(claimKey(jti)).catch(() => undefined);
    return;
  }
  memoryStore.delete(claimKey(jti));
}
