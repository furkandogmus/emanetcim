import type { Prisma } from "@prisma/client";
import prisma from "@/lib/db";
import { normalizeBookingCode } from "@/lib/booking-code";

/**
 * Esnaf rezervasyon aramasi: mobil `GET /partner/bookings?q=` ve web esnaf
 * listesi AYNI eslesmeyi kullanir.
 *
 * Eslesme (herhangi biri):
 *   - kod: kimligin onaltilik on eki (`D8A7FF57`, `d8a7-ff57`, web'deki `EMN-D8A7FF`)
 *   - ad: harf/Turkce-aksan duyarsiz "icerir" (Ilker = ılker = İLKER)
 *   - telefon: q en az 4 rakamsa, numaranin RAKAMLARININ sonu
 *
 * Kapsam cagiranin verdigi dukkan listesidir; bos liste hicbir sey dondurmez.
 * Sonuc bir kimlik filtresi: sayfalama ve siralama cagiranin sorgusunda kalir.
 */

export const MIN_PARTNER_SEARCH_LENGTH = 2;
const MIN_PHONE_DIGITS = 4;
/** Arama sonucu tavani: bir aramada bundan fazla eslesme anlamli degil. */
export const MAX_SEARCH_IDS = 1000;

/*
  Katlama TEK tanim: hem sutuna hem q'ya SQL'de ayni `translate` uygulanir.
  `lower('İ')` Postgres'te harmanlamaya gore `i̇` (noktali) ya da `İ` dondurur;
  once cevirip sonra kucultmek bunu devre disi birakir. `unaccent` eklentisi
  kurulu degil ve bunun icin migrasyon gerekmesin.
*/
const FOLD_FROM = "ÇĞİIÖŞÜÂÎÛçğıöşüâîû";
const FOLD_TO = "cgiiosuaiucgiosuaiu";

/** Bos ya da 2 karakterden kisa q yok sayilir (bugunku davranis). */
export function normalizePartnerSearchQuery(raw: string | null | undefined): string | null {
  const q = (raw ?? "").trim();
  if (q.length < MIN_PARTNER_SEARCH_LENGTH) return null;
  return q.slice(0, 100);
}

/** Kod on eki: yalnizca onaltilik ise; `EMN-` gorunur oneki dusurulur. */
export function bookingCodePrefix(q: string): string | null {
  const code = normalizeBookingCode(q).replace(/^emn/, "");
  return /^[0-9a-f]{2,32}$/.test(code) ? code : null;
}

/** Telefon kuyrugu: q yalnizca rakam ve telefon isaretlerinden olusuyorsa. */
export function phoneDigitsTail(q: string): string | null {
  if (!/^[\d\s+()-]+$/.test(q)) return null;
  const digits = q.replace(/\D/g, "");
  return digits.length >= MIN_PHONE_DIGITS ? digits : null;
}

function escapeLike(value: string): string {
  return value.replace(/[\\%_]/g, (c) => `\\${c}`);
}

export type PartnerBookingSearchMatch = {
  ids: string[];
  /** Tavandan bagimsiz GERCEK eslesme sayisi. */
  total: number;
  /** `ids` tavanda kesildi: istemci "ilk N sonuc" gosterebilir. */
  truncated: boolean;
};

export async function findPartnerBookingIds(shopIds: string[], q: string): Promise<PartnerBookingSearchMatch> {
  if (shopIds.length === 0) return { ids: [], total: 0, truncated: false };
  const code = bookingCodePrefix(q);
  const digits = phoneDigitsTail(q);
  const name = escapeLike(q);

  /*
    Tavan DETERMINISTIK: esnaf listesinin gecmis sirasi (bitis yeniden eskiye,
    sonra id). Sirasiz LIMIT hangi 1000'in donecegini Postgres'e birakirdi.
    `COUNT(*) OVER()` LIMIT'ten once hesaplanir: toplam kesilmez.
  */
  const rows = await prisma.$queryRaw<{ id: string; total: bigint | number }[]>`
    SELECT b."id", COUNT(*) OVER() AS "total"
    FROM "Booking" b
    LEFT JOIN "User" u ON u."id" = b."guestId"
    WHERE b."shopId" = ANY(${shopIds}::text[])
      AND (
        (${code}::text IS NOT NULL AND lower(replace(b."id", '-', '')) LIKE ${code}::text || '%')
        OR lower(translate(coalesce(u."name", ''), ${FOLD_FROM}, ${FOLD_TO}))
           LIKE '%' || lower(translate(${name}::text, ${FOLD_FROM}, ${FOLD_TO})) || '%' ESCAPE '\\'
        OR (${digits}::text IS NOT NULL AND (
          regexp_replace(coalesce(u."phone", ''), '\\D', '', 'g') LIKE '%' || ${digits}::text
          OR regexp_replace(coalesce(b."guestPhone", ''), '\\D', '', 'g') LIKE '%' || ${digits}::text
        ))
      )
    ORDER BY b."checkOutTime" DESC, b."id" DESC
    LIMIT ${MAX_SEARCH_IDS}
  `;
  const total = rows.length > 0 ? Number(rows[0].total) : 0;
  return { ids: rows.map((r) => r.id), total, truncated: total > rows.length };
}

export type PartnerBookingSearch = {
  /** Cagiranin `where`ine eklenecek parca; q yoksa bos nesne. */
  where: Prisma.BookingWhereInput;
  /** q yok sayildiysa null. */
  match: PartnerBookingSearchMatch | null;
};

/** q yok sayildiysa bugunku liste; varsa eslesen kimlikler (bos olabilir). */
export async function partnerBookingSearchWhere(
  shopIds: string[],
  rawQ: string | null | undefined,
): Promise<PartnerBookingSearch> {
  const q = normalizePartnerSearchQuery(rawQ);
  if (!q) return { where: {}, match: null };
  const match = await findPartnerBookingIds(shopIds, q);
  return { where: { id: { in: match.ids } }, match };
}
