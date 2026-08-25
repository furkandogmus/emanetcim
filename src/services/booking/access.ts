/**
 * Bir rezervasyona KİMİN erişebileceği.
 *
 * NEDEN ORTAK (2026-08-26'da ölçüldü): kural üç mobil uçta elle yazılmıştı
 * (`bookings/[id]`, `.../cancel`, `.../modify`) ve aralarında **kasıtlı ama
 * yazısız** bir fark vardı:
 *
 *   - OKUMA: misafirin kendisi, dükkan sahibi esnaf, veya admin
 *   - DEĞİŞTİRME (iptal/düzenleme): yalnızca misafirin kendisi veya admin
 *
 * Esnafın bir misafirin rezervasyonunu iptal edememesi DOĞRU: esnafın yolu
 * "reddet"tir ve o yol iade ile slot temizliğini `cancelBooking` üzerinden
 * yürütür. Ama bu fark üç kopyanın arasında yazısız duruyordu; biri
 * güncellenirken diğerinin geride kalması an meselesiydi.
 *
 * Fark artık ADI OLAN bir parametre: `allowShopPartner`.
 */

export type BookingActor = { id: string; role: string };

export type BookingAccessSubject = {
  guestId: string | null;
  shop: { ownerId: string };
};

/**
 * `allowShopPartner`: dükkan sahibi esnaf da erişebilir mi?
 * OKUMA için `true` (esnaf paneli rezervasyonu görmeli),
 * DEĞİŞTİRME için `false` (esnafın yolu "reddet").
 */
export function canAccessBooking(
  booking: BookingAccessSubject,
  actor: BookingActor,
  opts: { allowShopPartner: boolean },
): boolean {
  if (actor.role === "ADMIN") return true;
  if (booking.guestId && booking.guestId === actor.id) return true;
  if (opts.allowShopPartner && actor.role === "PARTNER") {
    return booking.shop.ownerId === actor.id;
  }
  return false;
}
