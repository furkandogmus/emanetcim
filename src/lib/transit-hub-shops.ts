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

/**
 * Ince icerik kapisi: yaricapta ISLEYEN bir dukkan olmali ve yer, komsusunun
 * kopyasi olarak isaretlenmemis olmali (`TransitHub.indexable`).
 */
export function isHubIndexable(hub: TransitHub, result: { shops: readonly unknown[] }): boolean {
  return hub.indexable !== false && result.shops.length > 0;
}

/**
 * Sayfanin ve site haritasinin ORTAK sorgusu: ikisi ayni mesafe hesabiyla
 * (PostGIS `ST_Distance`) karar versin, sinirdaki dukkan birinde var digerinde
 * yok olmasin. Prelaunch satirlari da gelir (istek formu icin); yaricap <= 1 km
 * yerlerde isleyen dukkan varsa onun 2 km'sindeki prelaunch zaten gizli.
 */
export function findHubShopRows(hub: TransitHub) {
  return getActiveShopsOrderedByDistanceKm({
    centerLat: hub.lat,
    centerLng: hub.lng,
    radiusKm: hubRadiusKm(hub),
    take: MAX_HUB_SHOPS,
  });
}

type HubRow = Awaited<ReturnType<typeof findHubShopRows>>[number];

function operatingRows(rows: HubRow[]): HubRow[] {
  return rows.filter(({ shop }) => !shop.isPrelaunch && shop.latitude != null && shop.longitude != null);
}

export async function getHubShops(hub: TransitHub, now: Date = new Date()): Promise<HubShopsResult> {
  const rows = await findHubShopRows(hub);
  const operating = operatingRows(rows);

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

/** Site haritasi icin: dizine girecek yerler. Yer basina tek, indeksli sorgu. */
export async function indexableHubs<H extends TransitHub>(hubs: readonly H[]): Promise<H[]> {
  const candidates = hubs.filter((h) => h.indexable !== false);
  const hits = await Promise.all(
    candidates.map(async (h) => isHubIndexable(h, { shops: operatingRows(await findHubShopRows(h)) })),
  );
  return candidates.filter((_, i) => hits[i]);
}
