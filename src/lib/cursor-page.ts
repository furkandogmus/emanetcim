/**
 * Mobil listeler icin imlecli sayfalama. Imlec son satirin `id`'si; cagiran
 * siralamanin sonuna `{ id }` eklemek zorunda, yoksa ayni zaman damgali satirlar
 * sayfa sinirinda kaybolur ya da iki kez gelir. Ofset degil imlec: liste arada
 * buyuyunce (yeni rezervasyon, yeni mesaj) ofset kayar ve satir atlanir.
 */

/** Prisma id'leri (uuid / cuid) disindaki girdi imlec sayilmaz. */
const CURSOR_RE = /^[A-Za-z0-9_-]{1,64}$/;

export function parseCursor(raw: string | null | undefined): string | null {
  const v = (raw ?? "").trim();
  return CURSOR_RE.test(v) ? v : null;
}

/** `?limit=` okuma; gecersizse varsayilan, her durumda [1, max]. */
export function parseLimit(raw: string | null | undefined, fallback: number, max: number): number {
  const n = Math.floor(Number(raw));
  if (!Number.isFinite(n) || n < 1) return Math.min(fallback, max);
  return Math.min(n, max);
}

/** `findMany`'ye eklenir: bir fazlasini ister (sonraki sayfa var mi), imlec satirini atlar. */
export function cursorArgs(cursor: string | null, take: number) {
  return { take: take + 1, ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}) };
}

/** `take + 1` satirdan sayfa ve sonraki imlec. */
export function toPage<T extends { id: string }>(rows: T[], take: number): { items: T[]; nextCursor: string | null } {
  const hasMore = rows.length > take;
  const items = hasMore ? rows.slice(0, take) : rows;
  return { items, nextCursor: hasMore ? items[items.length - 1].id : null };
}
