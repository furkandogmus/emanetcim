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
function squash(v: string): string {
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
  const q = squash(query);
  if (q.length === 0) return [];
  return items.filter((b) => squash(b.id).startsWith(q) || squash(b.guestName ?? "").includes(q));
}

/** Sunucunun aramaya aldigi en kisa terim; altindaki `q` sunucuda yok sayilir. */
export const SERVER_SEARCH_MIN = 2;

/** Sunucuya giden terim: fisteki "#ABCD1234" de yazilabilir. Kisaysa bos (istek yok). */
export function partnerSearchTerm(raw: string): string {
  const term = raw.trim().replace(/^#/, "").trim();
  return term.length >= SERVER_SEARCH_MIN ? term : "";
}

/** Sunucu telefonun son hanelerini de arar: 4+ rakamli terimde satirda gorunmeyen eslesme olabilir. */
export function isPhoneLikeTerm(term: string): boolean {
  return term.replace(/\D/g, "").length >= 4;
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
