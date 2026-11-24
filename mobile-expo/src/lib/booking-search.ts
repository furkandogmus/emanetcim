import type { PartnerBooking } from "@/lib/types";

/** Misafirin fisindeki kod: `BookingTicket` ile ayni (id'nin ilk 8 hanesi, buyuk harf). */
export function bookingCode(id: string): string {
  return id.slice(0, 8).toUpperCase();
}

/**
 * Bosluk, tire, buyuk/kucuk harf ve aksan farki aramayi bozmasin. Noktali/noktasiz I
 * once tek harfe ("i") indirilir: klavye "ALI" gonderir, `toLocaleLowerCase("tr")` bunu
 * "alı" yapardi ve kayitli "Ali" ("ali") bulunamazdi. Turistlerin adlari (Maria, Smith)
 * icin de ayni. Dil bagimsiz kucultme kullanilir.
 */
export function squash(v: string): string {
  return v
    .replace(/[İıI]/g, "i")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[\s-]/g, "");
}

/**
 * Esnafin yuklu listesinde misafir adi ya da rezervasyon koduna (id on eki) gore arar.
 * Sunucuya gitmez: aktif rezervasyonlarin hepsi zaten listede.
 */
export function searchBookings(items: PartnerBooking[], query: string): PartnerBooking[] {
  // Fisteki "#ABCD1234" gibi yazilan kod da bulunsun.
  const q = squash(query.trim().replace(/^#/, ""));
  if (q.length === 0) return [];
  // E-postadaki "EMN-ABCD1234" bicimi: sunucu (`bookingCodePrefix`) gibi on ek kod icin atilir.
  const code = /^emn[0-9a-f]+$/.test(q) ? q.slice(3) : q;
  return items.filter((b) => squash(b.id).startsWith(code) || squash(b.guestName ?? "").includes(q));
}

/** Sunucunun aramaya aldigi en kisa terim; altindaki `q` sunucuda yok sayilir. */
export const SERVER_SEARCH_MIN = 2;

/** Sunucuya giden terim: fisteki "#ABCD1234" de yazilabilir. Kisaysa bos (istek yok). */
export function partnerSearchTerm(raw: string): string {
  const term = raw.trim().replace(/^#/, "").trim();
  return term.length >= SERVER_SEARCH_MIN ? term : "";
}

/**
 * Sunucunun telefon kurali (`phoneDigitsTail`) ile birebir: yalnizca rakam ve telefon isaretleri,
 * en az 4 rakam. "ab12cd34" gibi kod telefon sayilmaz; sayilsaydi eski sunucunun tum listesi suzulmezdi.
 */
export function isPhoneLikeTerm(term: string): boolean {
  return /^[\d\s+()-]+$/.test(term) && term.replace(/\D/g, "").length >= 4;
}

/**
 * Sunucu sonucunu yerel kurala gore suzer. `q`yu bilmeyen eski sunucu tum listeyi doner;
 * suzulmezse aramada her rezervasyon "eslesir". Telefon gibi terimde suzulmez: eslesme
 * satirda olmayan telefon alanindan gelmis olabilir.
 */
export function refineServerSearch(items: PartnerBooking[], term: string): PartnerBooking[] {
  if (isPhoneLikeTerm(term)) return items;
  return searchBookings(items, term);
}
