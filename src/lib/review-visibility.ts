import type { Prisma } from "@prisma/client";

/**
 * Misafire gosterilen ve ortalamaya giren yorumlar: yonetici gizlemediyse.
 *
 * TEK FILTRE (2026-11-23): gizleme eklenince yorumu okuyan her yuzey (dukkan
 * sayfasi, JSON-LD, mobil liste, ana sayfa yorumlari, guven istatistigi) ve
 * `Shop.rating` hesabi ayni kosulu tasimali. Biri unutulursa gizlenen yorum
 * ortalamayi asagi cekmeye ya da ana sayfada gorunmeye devam eder.
 */
export const VISIBLE_REVIEW = { hiddenAt: null } satisfies Prisma.ReviewWhereInput;
