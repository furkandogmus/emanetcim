import type { ShopSearchHit } from "@/services/ShopService";

/**
 * Arama kutusundaki metnin NE OLDUGU.
 *
 * - `place`: bir yere cozumlendi (geocode ya da bilinen sehir). Merkez zaten
 *   oraya tasindi; metni ayrica suzgec olarak kullanmak YANLIS.
 * - `pending`: geocode sonucu henuz gelmedi (450 ms geciktirme).
 * - `text`: bir yere cozulemedi; kullanici dukkan adi ariyor.
 */
export type SearchQueryKind = "pending" | "place" | "text";

export type SearchFilterCriteria = {
  query: string;
  queryKind: SearchQueryKind;
  minRating: number;
  maxPrice: number;
  open247Only: boolean;
  hasRestroom: boolean;
  hasCctv: boolean;
  hasClimateControl: boolean;
  acceptsLargeItems: boolean;
};

/**
 * Bir noktanin arama filtrelerinden gecip gecmedigi.
 *
 * NEDEN AYRI DOSYA (2026-09-01): bu kural iki sey icin ayni cevabi vermek
 * zorunda -- listede cizilen kartlar ve sekme basligindaki sayi. Uretimde
 * ayrilmislardi: sekme "TUM NOKTALAR (100)" derken liste 7 kart gosteriyordu.
 * Tek fonksiyon, tek cevap.
 *
 * METIN SUZGECI YALNIZCA `text` TURUNDE calisir. `place` iken metni suzgec
 * yapmak, aranan sehrin cevresindeki noktalari adres yazimina gore eliyordu:
 * `q=amsterdam` aramasi Amsterdam'a 51 km'deki Den Haag noktasini
 * dusuruyordu, cunku adresinde "amsterdam" gecmiyor.
 */
export function matchesSearchFilters(
  shop: ShopSearchHit,
  c: SearchFilterCriteria,
): boolean {
  const q = c.queryKind === "text" ? c.query.trim().toLowerCase() : "";
  const matchText =
    q === "" ||
    shop.name.toLowerCase().includes(q) ||
    (shop.address ?? "").toLowerCase().includes(q);
  if (!matchText) return false;

  if ((shop.rating ?? 0) < c.minRating) return false;
  if ((shop.pricePerDay ?? 50) > c.maxPrice) return false;
  if (c.open247Only && shop.open247 !== true) return false;
  if (c.hasRestroom && shop.hasRestroom !== true) return false;
  if (c.hasCctv && shop.hasCctv !== true) return false;
  if (c.hasClimateControl && shop.hasClimateControl !== true) return false;
  if (c.acceptsLargeItems && shop.acceptsLargeItems !== true) return false;
  return true;
}
