/**
 * Misafirin ekranında gördüğü rezervasyon kodunu aranabilir hale getirir.
 *
 * NEDEN GEREKLİ: kod ekranda BÜYÜK HARF yazılı
 * (`bookings/[id]/page.tsx` → `booking.id.slice(0, 8).toUpperCase()`), kimlik
 * ise küçük harf saklanıyor. Postgres'te `startsWith` harf duyarlı; misafir
 * KENDİ ekranındaki kodu yazdığında "Rezervasyon bulunamadı" alıyordu ve hatayı
 * kendi yazımından ayırt edemiyordu.
 *
 * Boşluk ve tire de temizleniyor: bu kod telefonda okunarak aktarılıyor,
 * "d8a7 ff57" ya da "D8A7-FF57" yazılması olağan.
 */
export function normalizeBookingCode(raw: unknown): string {
  return String(raw ?? "")
    .trim()
    .toLowerCase()
    .replace(/[\s-]/g, "");
}

/**
 * Arama için kabul edilebilir en kısa kod.
 *
 * Daha kısası aynı e-postanın rezervasyonları içinde bile çakışabilir ve YANLIŞ
 * rezervasyonun QR'ını vermek, hiç vermemekten kötüdür: esnaf tarar, tarih ve
 * valiz sayısı tutmaz.
 */
export const MIN_BOOKING_CODE_LENGTH = 6;
