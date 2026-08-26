/**
 * Bir rezervasyonun bildirim ALICISI.
 *
 * NEDEN AYRI (2026-08-25'te olculdu): "misafire haber ver" kurali iki tasiyicida
 * FARKLI yazilmisti ve ikisi de YARIMDI:
 *
 *   - web  (`actions/partner.ts`): `booking.guest?.email`
 *   - mobil (`api/mobile/bookings/[id]/check-in`): `booking.guestEmail`
 *
 * Rezervasyon ya hesapli (`guestId` -> `guest.email`) ya da hesapsiz misafir
 * checkout'udur (`guestEmail`); ikisi ayni anda dolu degildir. Sonuc:
 *
 *   - Web'den check-in yapildiginda HESAPSIZ misafir e-posta ALMIYORDU.
 *   - Mobilden check-in yapildiginda HESAPLI misafir e-posta ALMIYORDU.
 *
 * Yani her iki yol da musterilerinin yarisini sessizce atliyordu. Kural artik
 * tek satir ve tek yerde.
 */

/** `select` / `include` ile en az bu iki alan cekilmis olmali. */
export type BookingContactFields = {
  guestEmail?: string | null;
  guest?: { email?: string | null } | null;
};

/**
 * Bildirimin gidecegi e-posta; hicbiri yoksa `null`.
 *
 * Hesap e-postasi ONCELIKLI: hesapli bir kullanici e-postasini degistirdiginde
 * guncel adres orasidir, rezervasyon anindaki `guestEmail` degil.
 */
export function bookingNotificationEmail(booking: BookingContactFields): string | null {
  const email = booking.guest?.email ?? booking.guestEmail ?? null;
  // Bos string ve "@" tasimayan yer tutucular alici sayilmaz.
  return email && email.includes("@") ? email : null;
}
