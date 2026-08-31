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

/**
 * Rezervasyon kimliğinden misafire GÖSTERİLEN kodu üretir.
 *
 * NEDEN BURADA: bu kod üç uçta birden görünüyor — misafirin rezervasyon
 * sayfası, e-posta/SMS bildirimleri, ve `/bookings/lookup` formu. Üçü ayrı ayrı
 * `id.replace(/-/g, "").slice(0, 8)` yazıyordu ve uçlar sessizce ayrışmıştı:
 * sayfa BÜYÜK harf gösterirken bildirimler küçük harf gönderiyordu. Hesabı
 * olmayan misafir için bu iki ucu birleştirmek zorunda olduğu tek an, e-postadaki
 * kodu forma yazdığı andır; orada aynı şeyin iki farklı yazımını görüyordu.
 *
 * `normalizeBookingCode` bunun okuma tarafı: burası ne ürettiyse o onu geri
 * getirir. İkisi aynı dosyada duruyor ki biri değişirse diğeri gözden kaçmasın.
 */
export function bookingShortCode(bookingId: string): string {
  return bookingId.replace(/-/g, "").slice(0, 8).toUpperCase();
}
