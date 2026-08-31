import type { Shop } from "@prisma/client";
import { Prisma } from "@prisma/client";
import prisma from "@/lib/db";
import logger from "@/lib/logger";
import { distanceKm } from "@/lib/geo";
import {
  PUBLIC_SHOP_FILTER,
  PUBLIC_SHOP_SQL_CONDITION,
} from "@/lib/public-shop-filter";

type IdDistRow = { id: string; dist_km: unknown };

function distanceSubselect(centerLat: number, centerLng: number) {
  return Prisma.sql`
    SELECT
      s.id,
      (
        ST_Distance(
          geography(ST_SetSRID(ST_MakePoint(s."longitude", s."latitude"), 4326)),
          geography(ST_SetSRID(ST_MakePoint(${centerLng}, ${centerLat}), 4326))
        )
        / 1000.0
      ) AS dist_km
    FROM "Shop" s
    WHERE ${Prisma.raw(PUBLIC_SHOP_SQL_CONDITION)}
      AND s."latitude" IS NOT NULL
      AND s."longitude" IS NOT NULL
  `;
}

function mapRowsToShops(
  rows: IdDistRow[],
  shops: Shop[],
): Array<{ shop: Shop; distanceKm: number }> {
  const shopById = new Map(shops.map((s) => [s.id, s]));
  const out: Array<{ shop: Shop; distanceKm: number }> = [];
  for (const r of rows) {
    const shop = shopById.get(r.id);
    if (!shop) continue;
    const d = Number(r.dist_km);
    if (!Number.isFinite(d)) continue;
    out.push({ shop, distanceKm: d });
  }
  return out;
}

/**
 * PostGIS yolunun SON durumu — `/api/health` bunu okuyor.
 *
 * NEDEN VAR (2026-08-31'de olculdu): asagidaki `catch` HICBIR SEY loglamiyordu.
 * PostGIS eklentisi kurulu degilse ya da sorgu hata verirse, arama sessizce
 * `fallbackActiveShopsByDistance`e dusuyor: **butun** aktif dukkanlari bellege
 * alip orada siraliyor. Sonuclar dogru cikiyor -- o yuzden disaridan hicbir sey
 * yanlis gorunmuyor -- ama sitenin en cok trafik alan sayfasi her istekte tam
 * tablo tarayip bellek ici siralama yapiyor ve bunu kimse GOREMIYOR.
 *
 * `rules/observability`: bir uretim bozulmasini gizleyen sessiz yedek yol,
 * bozulmanin kendisinden daha pahalidir.
 *
 * Log bir kez atilir (durum degistiginde): her arama icin bir satir yazmak
 * log'u bosaltir ve asil sinyali gomer.
 */
type DistanceBackend = "postgis" | "in_memory_fallback" | "unknown";

let lastBackend: DistanceBackend = "unknown";

export function getShopDistanceBackend(): DistanceBackend {
  return lastBackend;
}

function noteBackend(next: Exclude<DistanceBackend, "unknown">, err?: unknown) {
  if (lastBackend === next) return;
  const previous = lastBackend;
  lastBackend = next;
  if (next === "in_memory_fallback") {
    logger.warn(
      { err, previous },
      "shop_distance_postgis_unavailable_using_memory_fallback",
    );
  } else if (previous !== "unknown") {
    logger.info({ previous }, "shop_distance_postgis_restored");
  }
}

async function fallbackActiveShopsByDistance(
  centerLat: number,
  centerLng: number,
  radiusKm: number | null,
  skip: number,
  take: number | null,
): Promise<Array<{ shop: Shop; distanceKm: number }>> {
  const shops = await prisma.shop.findMany({
    where: PUBLIC_SHOP_FILTER,
  });
  const withDist = shops
    .filter((s) => s.latitude != null && s.longitude != null)
    .map((s) => ({
      shop: s,
      distanceKm: distanceKm(
        centerLat,
        centerLng,
        s.latitude!,
        s.longitude!,
      ),
    }))
    .filter((x) => radiusKm == null || x.distanceKm <= radiusKm)
    .sort((a, b) => a.distanceKm - b.distanceKm);

  if (take == null) return withDist;
  return withDist.slice(skip, skip + take);
}

export type ActiveShopsDistanceOptions = {
  centerLat: number;
  centerLng: number;
  /** null = yarıçap filtresi yok (tüm aktif, koordinatlı dükkanlar) */
  radiusKm: number | null;
  skip?: number;
  take?: number | null;
};

/**
 * Aktif dükkanları merkeze göre km mesafesiyle sıralar.
 * PostGIS yoksa veya sorgu hata verirse Haversine + bellek içi sıralamaya düşer.
 */
export async function getActiveShopsOrderedByDistanceKm(
  options: ActiveShopsDistanceOptions,
): Promise<Array<{ shop: Shop; distanceKm: number }>> {
  const {
    centerLat,
    centerLng,
    radiusKm,
    skip = 0,
    take = null,
  } = options;

  const radiusFilter =
    radiusKm == null
      ? Prisma.sql`TRUE`
      : Prisma.sql`sub.dist_km <= ${radiusKm}`;

  const limitFrag =
    take == null
      ? Prisma.empty
      : Prisma.sql`LIMIT ${take} OFFSET ${skip}`;

  try {
    const rows = await prisma.$queryRaw<IdDistRow[]>`
      SELECT sub.id, sub.dist_km
      FROM (${distanceSubselect(centerLat, centerLng)}) AS sub
      WHERE ${radiusFilter}
      ORDER BY sub.dist_km ASC
      ${limitFrag}
    `;

    if (rows.length === 0) {
      noteBackend("postgis");
      return [];
    }

    const ids = rows.map((r) => r.id);
    const shops = await prisma.shop.findMany({
      where: { id: { in: ids }, ...PUBLIC_SHOP_FILTER },
    });
    noteBackend("postgis");
    return mapRowsToShops(rows, shops);
  } catch (err) {
    /*
      Yedek yol SESSIZ DEGIL (2026-08-31). Onceden `catch {}` idi: PostGIS
      eksikse ya da sorgu hata verdiyse arama, butun aktif dukkanlari bellege
      alip siralayan yola dusuyor ve bunu hicbir yere yazmiyordu. Sonuclar
      dogru olduğu icin disaridan da anlasilmiyordu.
    */
    noteBackend("in_memory_fallback", err);
    return fallbackActiveShopsByDistance(
      centerLat,
      centerLng,
      radiusKm,
      skip,
      take,
    );
  }
}
