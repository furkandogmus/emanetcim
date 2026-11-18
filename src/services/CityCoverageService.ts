import prisma from "@/lib/db";
import { OPERATING_SHOP_FILTER } from "@/lib/public-shop-filter";

export type CityCoverage = {
  /** En sik yazilan bicim ("İstanbul"); gruplama buyuk/kucuk harf ve bosluktan bagimsiz. */
  name: string;
  shopCount: number;
  /** Sehirdeki dukkanlarin merkezi: arama oraya acilir, sehir merkezi sabiti gerekmez. */
  latitude: number;
  longitude: number;
  /** Sehirde fotografi olan ilk dukkanin gorseli; mobilde sehir fotografi yoksa kullanilir. */
  coverImage: string | null;
};

const TTL_MS = 10 * 60 * 1000;

/**
 * Misafirin ana sayfasindaki "Populer sehirler": yeni bir sehirde esnaf acilinca
 * kendiliginden gorunur, son dukkani kapanan sehir duser. Eskiden mobilde sabit
 * listeydi ve dukkani olmayan sehirler de gosteriliyordu.
 * Yalnizca isletilen dukkanlar (talep testi noktalari mobilde gosterilmiyor).
 */
export class CityCoverageService {
  private cache: { at: number; value: CityCoverage[] } | null = null;

  async list(now: number = Date.now()): Promise<CityCoverage[]> {
    if (this.cache && now - this.cache.at < TTL_MS) return this.cache.value;

    const shops = await prisma.shop.findMany({
      where: { ...OPERATING_SHOP_FILTER, city: { not: null }, latitude: { not: null }, longitude: { not: null } },
      select: { city: true, latitude: true, longitude: true, image: true },
    });

    const groups = new Map<string, { spellings: Map<string, number>; lat: number; lng: number; n: number; located: number; image: string | null }>();
    for (const s of shops) {
      const raw = s.city!.trim();
      if (!raw) continue;
      const key = raw.toLocaleLowerCase("tr-TR");
      const g = groups.get(key) ?? { spellings: new Map(), lat: 0, lng: 0, n: 0, located: 0, image: null };
      g.spellings.set(raw, (g.spellings.get(raw) ?? 0) + 1);
      g.n += 1;
      /*
        Aralik disi bir koordinat (prod'da ~3e16 boylamli bir kayit goruldu,
        2026-11-18) tek basina sehir merkezini haritanin disina tasir. Dukkan
        sayilir ama merkeze katilmaz.
      */
      if (Math.abs(s.latitude!) <= 90 && Math.abs(s.longitude!) <= 180) {
        g.lat += s.latitude!;
        g.lng += s.longitude!;
        g.located += 1;
      }
      g.image ??= s.image;
      groups.set(key, g);
    }

    const value = [...groups.values()]
      .filter((g) => g.located > 0)
      .map((g) => ({
        name: [...g.spellings.entries()].sort((a, b) => b[1] - a[1])[0][0],
        shopCount: g.n,
        latitude: g.lat / g.located,
        longitude: g.lng / g.located,
        coverImage: g.image,
      }))
      .sort((a, b) => b.shopCount - a.shopCount || a.name.localeCompare(b.name, "tr"));

    this.cache = { at: now, value };
    return value;
  }
}

export const cityCoverageService = new CityCoverageService();
