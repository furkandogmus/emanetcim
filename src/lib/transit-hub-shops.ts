import prisma from "@/lib/db";
import { distanceKm } from "@/lib/geo";
import { OPERATING_SHOP_FILTER } from "@/lib/public-shop-filter";
import { getActiveShopsOrderedByDistanceKm } from "@/lib/shop-distance-postgis";
import { hoursForDate, isOpenAt, type DayHours } from "@/lib/shop-schedule";
import { todayInZone } from "@/lib/stay-days";
import { PLATFORM_TIMEZONE } from "@/lib/datetime-local";
import { loadScheduleParts } from "@/services/ShopScheduleService";
import { prelaunchInterestService } from "@/services/PrelaunchInterestService";
import { hubRadiusKm, type TransitHub } from "@/lib/transit-hubs";

export type HubShop = {
  id: string;
  name: string;
  district: string | null;
  address: string | null;
  latitude: number;
  longitude: number;
  distanceKm: number;
  openNow: boolean;
  /** Bugunun saatleri; kapali gun ise null. */
  todayHours: DayHours | null;
};

export type HubPrelaunchPoint = { id: string; name: string; wantCount: number };

export type HubShopsResult = {
  shops: HubShop[];
  /** Isleyen dukkan yokken "burada olsun" formunun bagli oldugu talep testi noktasi. */
  prelaunch: HubPrelaunchPoint | null;
};

const MAX_HUB_SHOPS = 12;

/** Ince icerik kapisi: sayfa ancak yaricapta ISLEYEN bir dukkan varsa dizine girer. */
export function isHubIndexable(result: Pick<HubShopsResult, "shops">): boolean {
  return result.shops.length > 0;
}

/**
 * Yer sayfasinin dukkan listesi. Hata YUTULMAZ: sehir sayfasindan farkli olarak
 * bos liste burada `noindex` demek; gecici bir veritabani hatasi sayfayi dizinden
 * dusurmesin, ISR eski surumu sunmaya devam etsin.
 */
export async function getHubShops(hub: TransitHub, now: Date = new Date()): Promise<HubShopsResult> {
  const rows = await getActiveShopsOrderedByDistanceKm({
    centerLat: hub.lat,
    centerLng: hub.lng,
    radiusKm: hubRadiusKm(hub),
  });
  const operating = rows
    .filter(({ shop }) => !shop.isPrelaunch && shop.latitude != null && shop.longitude != null)
    .slice(0, MAX_HUB_SHOPS);

  if (operating.length === 0) {
    const nearest = rows.find(({ shop }) => shop.isPrelaunch);
    if (!nearest) return { shops: [], prelaunch: null };
    const wantCount = await prelaunchInterestService.wantCount(nearest.shop.id);
    return { shops: [], prelaunch: { id: nearest.shop.id, name: nearest.shop.name, wantCount } };
  }

  const schedules = await loadScheduleParts(
    operating.map(({ shop }) => shop.id),
    todayInZone(PLATFORM_TIMEZONE, now),
  );
  const shops = operating.map(({ shop, distanceKm: d }): HubShop => {
    const schedule = {
      open247: shop.open247,
      openingTime: shop.openingTime,
      closingTime: shop.closingTime,
      timeZone: shop.timezone,
      ...(schedules.get(shop.id) ?? { weekly: [], closures: [] }),
    };
    return {
      id: shop.id,
      name: shop.name,
      district: shop.district,
      address: shop.address,
      latitude: shop.latitude!,
      longitude: shop.longitude!,
      distanceKm: d,
      openNow: isOpenAt(schedule, now),
      todayHours: hoursForDate(schedule, todayInZone(shop.timezone || PLATFORM_TIMEZONE, now)),
    };
  });
  return { shops, prelaunch: null };
}

type Located = { latitude: number; longitude: number };

/** Site haritasi icin: yaricapinda en az bir isleyen dukkan olan yerler. */
export function hubsWithOperatingShop<H extends TransitHub>(
  hubs: readonly H[],
  operatingShops: readonly Located[],
): H[] {
  return hubs.filter((hub) =>
    operatingShops.some(
      (s) => distanceKm(hub.lat, hub.lng, s.latitude, s.longitude) <= hubRadiusKm(hub),
    ),
  );
}

export async function operatingShopLocations(): Promise<Located[]> {
  const rows = await prisma.shop.findMany({
    where: { ...OPERATING_SHOP_FILTER, latitude: { not: null }, longitude: { not: null } },
    select: { latitude: true, longitude: true },
  });
  return rows.map((r) => ({ latitude: r.latitude!, longitude: r.longitude! }));
}
