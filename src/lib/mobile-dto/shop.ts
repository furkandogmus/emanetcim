import { moneyToNumber } from "@/lib/money";

type ShopSummarySource = {
  id: string;
  name: string;
  address: string | null;
  city: string | null;
  district: string | null;
  image: string | null;
  latitude: number | null;
  longitude: number | null;
  pricePerDay: unknown;
  capacity: number;
  rating: number | null;
  openingTime: string | null;
  closingTime: string | null;
  open247: boolean;
  hasRestroom: boolean;
  hasCctv: boolean;
  hasClimateControl: boolean;
  acceptsLargeItems: boolean;
  isActive: boolean;
  isVerified: boolean;
  isPrelaunch?: boolean;
};

/**
 * Dükkan gövdesi. `isVerified` HER İKİ uçta da bulunur: güven rozeti ürünün
 * temel vaadi, listede gösterip detayda gizlemek tutarsızdı.
 *
 * `isPrelaunch` de aynı sebeple burada: 2026-08-31'de arama, talep testi
 * noktalarını da döndürmeye başladı (`findShopsForSearch`) ve `/mobile/shops/
 * nearby` aynı servisi kullanıyor. Bayrak taşınmazsa mobil istemci bu noktayı
 * normal bir dükkandan AYIRT EDEMEZ: ₺250 (şema varsayılanı, gerçek fiyat değil)
 * ve "Rezervasyon yap" gösterir, misafir dener ve sunucudan `409
 * shop_not_open_yet` yer. Sunucu kapısı sağlam, ama misafire tutamayacağımız
 * sözü verdikten sonra reddetmek kapının işi değil — arayüzün işi.
 */
export type MobileSchedule = {
  weekly: { weekday: number; isClosed: boolean; openingTime: string; closingTime: string }[];
  closures: { startDate: string; endDate: string }[];
};

export function toMobileShop(s: ShopSummarySource, schedule?: MobileSchedule) {
  return {
    id: s.id,
    name: s.name,
    address: s.address,
    city: s.city,
    district: s.district,
    image: s.image,
    latitude: s.latitude,
    longitude: s.longitude,
    pricePerDay: moneyToNumber(s.pricePerDay),
    capacity: s.capacity,
    rating: s.rating,
    openingTime: s.openingTime,
    closingTime: s.closingTime,
    open247: s.open247,
    hasRestroom: s.hasRestroom,
    // Olanak rozetleri ve mobil suzgec: web dukkan sayfasindaki ayni uc alan.
    hasCctv: s.hasCctv,
    hasClimateControl: s.hasClimateControl,
    acceptsLargeItems: s.acceptsLargeItems,
    isActive: s.isActive,
    isVerified: s.isVerified,
    isPrelaunch: s.isPrelaunch ?? false,
    ...(schedule
      ? {
          weeklyHours: schedule.weekly.map((w) => ({
            weekday: w.weekday,
            isClosed: w.isClosed,
            openingTime: w.openingTime,
            closingTime: w.closingTime,
          })),
          closures: schedule.closures.map((c) => ({ startDate: c.startDate, endDate: c.endDate })),
        }
      : {}),
  };
}

// --- /Arama: ilceler ---

/** Dukkan galerisindeki bir fotograf (esnaf yonetimi icin kimlikli). */
export function toMobileGalleryImage(i: { id: string; url: string }) {
  return { id: i.id, url: i.url };
}

/** Misafirin dukkan detayindaki galeri: yalnizca adresler, sirali. */
export function toMobilePublicGallery(images: Array<{ url: string }>) {
  return images.map((i) => i.url);
}
