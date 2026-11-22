import type { QueryClient } from "@tanstack/react-query";

import { api } from "./api";
import { citySlug } from "./city-images";
import type { Place } from "./search";
import type { CityCoverage, DistrictCoverage } from "./types";

/** Sehir satirinin bugunku davranisi; ilce adimindaki "Merkez" de tam olarak budur. */
export function cityPlace(c: CityCoverage): Place {
  return { label: c.name, latitude: c.latitude, longitude: c.longitude, radiusM: c.radiusM };
}

/** "Kadıköy, İstanbul"; yaricap haritanin varsayilani (ilce bir sehir kadar genis degil). */
export function districtPlace(d: DistrictCoverage, city: CityCoverage): Place {
  return { label: `${d.name}, ${city.name}`, latitude: d.latitude, longitude: d.longitude };
}

export function cityDistrictsQuery(city: CityCoverage) {
  const slug = city.slug ?? citySlug(city.name);
  return {
    queryKey: ["cities", slug, "districts"] as const,
    queryFn: () =>
      api<{ districts: DistrictCoverage[] }>(`/cities/${encodeURIComponent(slug)}/districts`, { auth: false }).then(
        (r) => r.districts,
      ),
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
