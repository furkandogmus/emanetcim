import prisma from "@/lib/db";
import { OPERATING_SHOP_FILTER } from "@/lib/public-shop-filter";
import { distanceKm } from "@/lib/geo";
import { citySlug } from "@/lib/city-slug";

export type CityCoverage = {
  /** En sik yazilan bicim ("İstanbul"); gruplama buyuk/kucuk harf ve bosluktan bagimsiz. */
  name: string;
  /** Yazim bicimine bagli olmayan anahtar ("istanbul"); gruplama ve istemci gorsel eslemesi bunu kullanir. */
  slug: string;
  shopCount: number;
  /**
   * Aramanin acildigi nokta: dukkanlarin ORTALAMASI degil, en yogun yerdeki dukkan
   * (digerlerine uzaklik toplami en kucuk olan, medoid). Il genis: Mugla'da Bodrum ile
   * Fethiye'nin ortalamasi ikisine de ~85 km uzakta, 15 km'lik aramada hicbiri cikmiyordu.
   */
  latitude: number;
  longitude: number;
  /** Merkezden sehrin en uzak dukkanina, payla. Arama bu yaricapla yapilir: hepsi gorunur. */
  radiusM: number;
  /** Sehirde fotografi olan ilk dukkanin gorseli; mobilde sehir fotografi yoksa kullanilir. */
  coverImage: string | null;
};

/** Bir sehrin, en az bir isletilen dukkani olan ilcesi (mobil aramada sehirden sonraki adim). */
export type DistrictCoverage = {
  /** En sik yazilan bicim ("Kadıköy"); gruplama yazim bicimine bagli degil. */
  name: string;
  /** `citySlug` ile ayni kural ("kadikoy"). */
  slug: string;
  shopCount: number;
  /** Ilcedeki dukkanlarin koordinat ORTALAMASI: arama buradan acilir. */
  latitude: number;
  longitude: number;
};

const TTL_MS = 10 * 60 * 1000;
const MIN_RADIUS_M = 5_000;
/** En uzak dukkan haritanin tam kenarinda kalmasin. */
const RADIUS_MARGIN_M = 3_000;

/** Digerlerine uzaklik toplami en kucuk nokta. Sehir basina birkac dukkan: O(n^2) sorun degil. */
function medoid(points: Array<[number, number]>): [number, number] {
  let best = points[0];
  let bestSum = Infinity;
  for (const p of points) {
    let sum = 0;
    for (const q of points) sum += distanceKm(p[0], p[1], q[0], q[1]);
    if (sum < bestSum) {
      bestSum = sum;
      best = p;
    }
  }
  return best;
}

/**
 * Misafirin ana sayfasindaki "Populer sehirler": yeni bir sehirde esnaf acilinca
 * kendiliginden gorunur, son dukkani kapanan sehir duser. Eskiden mobilde sabit
 * listeydi ve dukkani olmayan sehirler de gosteriliyordu.
 * Yalnizca isletilen dukkanlar (talep testi noktalari mobilde gosterilmiyor).
 */
export class CityCoverageService {
  private cache: { at: number; value: CityCoverage[] } | null = null;
  private districtCache: { at: number; value: Map<string, DistrictCoverage[]> } | null = null;

  async list(now: number = Date.now()): Promise<CityCoverage[]> {
    if (this.cache && now - this.cache.at < TTL_MS) return this.cache.value;

    const shops = await prisma.shop.findMany({
      where: { ...OPERATING_SHOP_FILTER, city: { not: null }, latitude: { not: null }, longitude: { not: null } },
      select: { city: true, latitude: true, longitude: true, image: true },
    });

    const groups = new Map<string, { spellings: Map<string, number>; points: Array<[number, number]>; n: number; image: string | null }>();
    for (const s of shops) {
      const raw = s.city!.trim();
      if (!raw) continue;
      const key = citySlug(raw);
      if (!key) continue;
      const g = groups.get(key) ?? { spellings: new Map(), points: [] as Array<[number, number]>, n: 0, image: null };
      g.spellings.set(raw, (g.spellings.get(raw) ?? 0) + 1);
      g.n += 1;
      /*
        Aralik disi bir koordinat (prod'da ~3e16 boylamli bir kayit goruldu,
        2026-11-18) tek basina sehir merkezini haritanin disina tasir. Dukkan
        sayilir ama merkeze katilmaz.
      */
      if (Math.abs(s.latitude!) <= 90 && Math.abs(s.longitude!) <= 180) {
        g.points.push([s.latitude!, s.longitude!]);
      }
      g.image ??= s.image;
      groups.set(key, g);
    }

    const value = [...groups.entries()]
      .filter(([, g]) => g.points.length > 0)
      .map(([slug, g]) => {
        const [latitude, longitude] = medoid(g.points);
        const farthestKm = Math.max(...g.points.map(([la, lo]) => distanceKm(latitude, longitude, la, lo)));
        return {
          slug,
          name: [...g.spellings.entries()].sort((a, b) => b[1] - a[1])[0][0],
          shopCount: g.n,
          latitude,
          longitude,
          radiusM: Math.round(Math.max(MIN_RADIUS_M, farthestKm * 1000 + RADIUS_MARGIN_M)),
          coverImage: g.image,
        };
      })
      .sort((a, b) => b.shopCount - a.shopCount || a.name.localeCompare(b.name, "tr"));

    this.cache = { at: now, value };
    return value;
  }

  /**
   * Sehrin ilceleri, Turkce alfabe sirasiyla. `city` sehir listesindeki `slug`
   * ("istanbul"); bilinmeyen sehirde bos liste doner. Elle tutulan ilce tablosu
   * YOK: yalnizca isletilen dukkani olan ilceler gelir, son dukkan kapaninca ilce duser.
   * Butun sehirler tek sorguda gruplanir ve sehir listesiyle ayni sure onbellekte durur.
   */
  async districts(city: string, now: number = Date.now()): Promise<DistrictCoverage[]> {
    if (!this.districtCache || now - this.districtCache.at >= TTL_MS) {
      this.districtCache = { at: now, value: await this.loadDistricts() };
    }
    return this.districtCache.value.get(citySlug(city)) ?? [];
  }

  private async loadDistricts(): Promise<Map<string, DistrictCoverage[]>> {
    const shops = await prisma.shop.findMany({
      where: {
        ...OPERATING_SHOP_FILTER,
        city: { not: null },
        district: { not: null },
        latitude: { not: null },
        longitude: { not: null },
      },
      select: { city: true, district: true, latitude: true, longitude: true },
    });

    type Group = { spellings: Map<string, number>; lat: number; lng: number; n: number };
    const byCity = new Map<string, Map<string, Group>>();
    for (const s of shops) {
      const cityKey = citySlug(s.city!.trim());
      const raw = s.district!.trim();
      const key = citySlug(raw);
      if (!cityKey || !key) continue;
      // Aralik disi koordinat (bkz. `list`) ilce merkezini haritanin disina tasirdi.
      if (Math.abs(s.latitude!) > 90 || Math.abs(s.longitude!) > 180) continue;
      const districts = byCity.get(cityKey) ?? new Map<string, Group>();
      const g = districts.get(key) ?? { spellings: new Map<string, number>(), lat: 0, lng: 0, n: 0 };
      g.spellings.set(raw, (g.spellings.get(raw) ?? 0) + 1);
      g.lat += s.latitude!;
      g.lng += s.longitude!;
      g.n += 1;
      districts.set(key, g);
      byCity.set(cityKey, districts);
    }

    const collator = new Intl.Collator("tr", { sensitivity: "base" });
    const out = new Map<string, DistrictCoverage[]>();
    for (const [cityKey, districts] of byCity) {
      const list = [...districts.entries()].map(([slug, g]) => ({
        slug,
        name: [...g.spellings.entries()].sort((a, b) => b[1] - a[1])[0][0],
        shopCount: g.n,
        latitude: g.lat / g.n,
        longitude: g.lng / g.n,
      }));
      out.set(cityKey, list.sort((a, b) => collator.compare(a.name, b.name)));
    }
    return out;
  }
}

export const cityCoverageService = new CityCoverageService();
