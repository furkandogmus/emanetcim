import type { PartnerBooking } from "@/lib/types";

/** Misafirin fisindeki kod: `BookingTicket` ile ayni (id'nin ilk 8 hanesi, buyuk harf). */
export function bookingCode(id: string): string {
  return id.slice(0, 8).toUpperCase();
}

/** Bosluk, tire ve buyuk/kucuk harf farki aramayi bozmasin. */
function squash(v: string): string {
  return v.toLocaleLowerCase("tr").replace(/[\s-]/g, "");
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
