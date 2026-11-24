import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * Rezervasyon kanali (`Booking.source`). Yalnizca istatistik: fiyat, indirim, komisyon
 * ve bonus bu degeri OKUMAZ (sahip karari 2026-11-25). Bu yuzden istemciden gelen atif
 * dogrulanir ama "guvenilir" sayilmasi gereken bir para yolu yoktur.
 */
export const BOOKING_SOURCES = ["web", "app", "walk_in", "poster"] as const;
export type BookingSource = (typeof BOOKING_SOURCES)[number];

/** Afis atif penceresi: QR okutulduktan sonra bu sure icinde baslayan rezervasyon (son dokunus). */
export const POSTER_ATTRIBUTION_WINDOW_MS = 30 * 60 * 1000;
/** Istemci saati kayabilir; gelecekteki damga bu kadar tolere edilir. */
const CLOCK_SKEW_MS = 2 * 60 * 1000;

export const POSTER_COOKIE = "bp_poster";
export const POSTER_COOKIE_MAX_AGE_S = POSTER_ATTRIBUTION_WINDOW_MS / 1000;

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** `/app?kaynak=afis-<dukkanId>` etiketinden dukkan kimligi; bicim tutmazsa null. */
export function posterShopIdFromAppLinkSource(source: string | null | undefined): string | null {
  const m = /^afis-(.+)$/.exec(source ?? "");
  return m && UUID_RE.test(m[1]) ? m[1].toLowerCase() : null;
}

function secret(): string {
  const s = process.env.AUTH_SECRET || process.env.NEXTAUTH_SECRET;
  if (!s?.trim()) throw new Error("AUTH_SECRET is required for poster attribution");
  return s;
}

function mac(payload: string): string {
  return createHmac("sha256", secret()).update(`poster-attr:${payload}`).digest("base64url");
}

/** Cerez degeri `<dukkanId>.<ms>.<imza>`: elle yazilan deger istatistigi sisirmesin. */
export function signPosterAttribution(shopId: string, now: Date = new Date()): string {
  const payload = `${shopId.toLowerCase()}.${now.getTime()}`;
  return `${payload}.${mac(payload)}`;
}

function withinWindow(atMs: number, nowMs: number): boolean {
  return Number.isFinite(atMs) && atMs <= nowMs + CLOCK_SKEW_MS && nowMs - atMs <= POSTER_ATTRIBUTION_WINDOW_MS;
}

/** Imzali ve pencere icindeyse dukkan kimligi. */
export function verifyPosterAttribution(raw: string | null | undefined, now: Date = new Date()): string | null {
  const parts = (raw ?? "").split(".");
  if (parts.length !== 3) return null;
  const [shopId, at, sig] = parts;
  if (!UUID_RE.test(shopId) || !/^\d{10,16}$/.test(at)) return null;
  const expected = Buffer.from(mac(`${shopId}.${at}`));
  const given = Buffer.from(sig);
  if (expected.length !== given.length || !timingSafeEqual(expected, given)) return null;
  return withinWindow(Number(at), now.getTime()) ? shopId.toLowerCase() : null;
}

export type ClientPosterAttribution = { shopId?: unknown; capturedAt?: unknown };

/**
 * Uygulamanin gonderdigi atif (`/shop/<id>?kaynak=afis-<id>` derin baglantisi). Imza yok:
 * damga istemcinin; yalniz bicim ve pencere denetlenir. Dukkanin varligini servis bakar.
 */
export function clientPosterAttribution(
  input: ClientPosterAttribution | null | undefined,
  now: Date = new Date(),
): string | null {
  if (!input || typeof input.shopId !== "string" || !UUID_RE.test(input.shopId)) return null;
  if (typeof input.capturedAt !== "string") return null;
  const at = Date.parse(input.capturedAt);
  return withinWindow(at, now.getTime()) ? input.shopId.toLowerCase() : null;
}
