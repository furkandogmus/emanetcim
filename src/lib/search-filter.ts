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

/** Olanak, fiyat ve puan suzgeci: web aramasi ve mobil `shops/nearby` ayni kurali okur. */
export type ShopAmenityCriteria = {
  minRating: number;
  /** `null`: ust sinir yok (mobil "hepsi"). Web varsayilani 500. */
  maxPrice: number | null;
  open247Only: boolean;
  hasRestroom: boolean;
  hasCctv: boolean;
  hasClimateControl: boolean;
  acceptsLargeItems: boolean;
};

export type SearchFilterCriteria = ShopAmenityCriteria & {
  query: string;
  queryKind: SearchQueryKind;
};

type FilterableShop = Pick<
  ShopSearchHit,
  "rating" | "pricePerDay" | "open247" | "hasRestroom" | "hasCctv" | "hasClimateControl" | "acceptsLargeItems"
>;

export const NO_AMENITY_FILTER: ShopAmenityCriteria = {
  minRating: 0,
  maxPrice: null,
  open247Only: false,
  hasRestroom: false,
  hasCctv: false,
  hasClimateControl: false,
  acceptsLargeItems: false,
};

/** Fiyat `pricePerDay` (dukkanin gunluk taban fiyati) uzerinden; puani olmayan 0 sayilir. */
export function matchesAmenityFilters(shop: FilterableShop, c: ShopAmenityCriteria): boolean {
  if ((shop.rating ?? 0) < c.minRating) return false;
  if (c.maxPrice != null && shop.pricePerDay > c.maxPrice) return false;
  if (c.open247Only && shop.open247 !== true) return false;
  if (c.hasRestroom && shop.hasRestroom !== true) return false;
  if (c.hasCctv && shop.hasCctv !== true) return false;
  if (c.hasClimateControl && shop.hasClimateControl !== true) return false;
  if (c.acceptsLargeItems && shop.acceptsLargeItems !== true) return false;
  return true;
}

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
  shop: FilterableShop & Pick<ShopSearchHit, "name" | "address">,
  c: SearchFilterCriteria,
): boolean {
  const q = c.queryKind === "text" ? c.query.trim().toLowerCase() : "";
  const matchText =
    q === "" ||
    shop.name.toLowerCase().includes(q) ||
    (shop.address ?? "").toLowerCase().includes(q);
  if (!matchText) return false;
  return matchesAmenityFilters(shop, c);
}

export const SEARCH_SORTS = ["distance", "price_asc", "price_desc", "rating"] as const;
export type SearchSort = (typeof SEARCH_SORTS)[number];

export function isSearchSort(v: unknown): v is SearchSort {
  return typeof v === "string" && (SEARCH_SORTS as readonly string[]).includes(v);
}

type SortableShop = { pricePerDay?: number | null; rating?: number | null; distanceKm?: number | null };

/** Siralama karsilastiricisi; `Array.prototype.sort` kararli oldugu icin esitler sirasini korur. */
export function compareShopsBy(sort: SearchSort): (a: SortableShop, b: SortableShop) => number {
  switch (sort) {
    case "price_asc":
      return (a, b) => (a.pricePerDay ?? 0) - (b.pricePerDay ?? 0);
    case "price_desc":
      return (a, b) => (b.pricePerDay ?? 0) - (a.pricePerDay ?? 0);
    case "rating":
      return (a, b) => (b.rating ?? 0) - (a.rating ?? 0);
    default:
      return (a, b) => (a.distanceKm ?? 9999) - (b.distanceKm ?? 9999);
  }
}
