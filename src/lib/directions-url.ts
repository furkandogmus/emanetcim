/**
 * "Yol tarifi" bağlantısı — TEK KAYNAK.
 *
 * NEDEN BURADA: üç yüzey üç ayrı şekilde yazıyordu ve biri ayrışmıştı. Arama
 * kartı ve dükkan detayı KOORDİNAT gönderiyordu; rezervasyon sayfası ise
 * `shopAddress` METNİNİ gönderiyordu.
 *
 * Fark, misafirin valizini taşırken önemli: adres metni Google tarafında
 * yeniden geocode ediliyor ve bizim verimizde o metin çoğu zaman ilçe/şehir
 * kadar kaba ("Sultanahmet, İstanbul" — talep testi noktalarının `address`
 * alanı tam olarak böyle kuruluyor) ya da esnafın elle yazdığı serbest metin.
 * Yani rezervasyon sayfası, elimizde KESİN koordinat dururken misafiri
 * tahmini bir noktaya yönlendirebiliyordu.
 *
 * Koordinat varsa koordinat; yoksa adres metni; o da yoksa bağlantı yok —
 * çalışmayan bir "Yol Tarifi" düğmesi, olmayan düğmeden kötüdür.
 */
export function buildDirectionsUrl(params: {
  latitude?: number | null;
  longitude?: number | null;
  address?: string | null;
}): string | null {
  const { latitude, longitude, address } = params;

  if (
    typeof latitude === "number" &&
    typeof longitude === "number" &&
    Number.isFinite(latitude) &&
    Number.isFinite(longitude)
  ) {
    return `https://www.google.com/maps/dir/?api=1&destination=${latitude},${longitude}`;
  }

  const text = address?.trim();
  if (text) {
    return `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(text)}`;
  }

  return null;
}
