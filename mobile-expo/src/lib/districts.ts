import type { QueryClient } from "@tanstack/react-query";

import { api } from "./api";
import { citySlug } from "./city-images";
import type { Place } from "./search";
import type { CityCoverage, DistrictCoverage } from "./types";

/** Sehir satirinin bugunku davranisi; ilce adimindaki "Merkez" de tam olarak budur. */
export function cityPlace(c: CityCoverage): Place {
  return { label: c.name, latitude: c.latitude, longitude: c.longitude, radiusM: c.radiusM };
}

/** "Kadıköy, İstanbul"; yaricap ilcenin butun dukkanlarini kapsar (sunucu, en az 15 km). */
export function districtPlace(d: DistrictCoverage, city: CityCoverage): Place {
  return { label: `${d.name}, ${city.name}`, latitude: d.latitude, longitude: d.longitude, radiusM: d.radiusM };
}

/** Yavas agda misafir bu kadar bekler, sonra sehir bugunku gibi secilir. */
export const DISTRICTS_TIMEOUT_MS = 5_000;

export function cityDistrictsQuery(city: CityCoverage) {
  const slug = city.slug ?? citySlug(city.name);
  return {
    queryKey: ["cities", slug, "districts"] as const,
    queryFn: ({ signal }: { signal: AbortSignal }) => {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), DISTRICTS_TIMEOUT_MS);
      signal.addEventListener("abort", () => controller.abort());
      return api<{ districts: DistrictCoverage[] }>(`/cities/${encodeURIComponent(slug)}/districts`, {
        auth: false,
        signal: controller.signal,
      })
        .then((r) => r.districts)
        .finally(() => clearTimeout(timer));
    },
    // Tekrar denemek, eski sunucuda (uc yok) misafiri saniyelerce bekletirdi.
    retry: false,
    staleTime: 10 * 60_000,
  };
}

/**
 * Ilce adimi gosterilecekse listesi, yoksa bos dizi. Hata FIRLATILMAZ: bu uctan once
 * yayinlanan sunucu HTML 404 doner (`http_404`); o zaman sehir bugunku gibi dogrudan
 * secilir. Verisi "Merkez" olan ilce ilk satirdaki "Merkez" ile karisirdi, listeden duser.
 */
export async function loadCityDistricts(queryClient: QueryClient, city: CityCoverage): Promise<DistrictCoverage[]> {
  try {
    const list = await queryClient.fetchQuery(cityDistrictsQuery(city));
    return Array.isArray(list) ? list.filter((d) => d.slug !== "merkez") : [];
  } catch {
    return [];
  }
}
