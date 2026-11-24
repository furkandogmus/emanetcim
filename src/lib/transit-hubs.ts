import { STORAGE_CITIES, type StorageCitySlug } from "@/lib/storage-cities";

/**
 * Turistin aradigi YER sayfalari: havalimani, otogar, istasyon, turistik semt.
 * URL `/{locale}/luggage-storage/{city}/{hub}`; slug her dilde aynidir (sehir
 * sayfalariyla ayni kural), metinler `TransitHubs.hubs.{slug}.*` altinda.
 *
 * Koordinatlar kamuya acik nirengi noktasi: terminal binasi, istasyon binasi,
 * meydan ya da iskele. Yeni sehir = bu listeye bir giris + dillerde metin.
 */
export type TransitHubKind = "airport" | "bus_terminal" | "rail_station" | "district";

export type TransitHub = {
  slug: string;
  city: StorageCitySlug;
  kind: TransitHubKind;
  lat: number;
  lng: number;
  /** Yalnizca tur varsayilani bu yer icin yanlissa. */
  radiusKm?: number;
  /**
   * false: ~1 km icindeki komsusuyla ayni dukkanlari listeler (kapi sayfasi riski);
   * sayfa erisilebilir kalir ama `noindex` ve site haritasi disi.
   */
  indexable?: false;
};

/**
 * "Bu yerin yaninda" sayilan en uzak dukkan. Havalimani sehir disinda oldugu
 * icin genis (terminale servisle/taksiyle yakin bolge); semt ve istasyonda
 * yurume mesafesi. Bu yaricapta isleyen dukkan yoksa sayfa `noindex` olur.
 */
export const HUB_KIND_RADIUS_KM: Record<TransitHubKind, number> = {
  airport: 8,
  bus_terminal: 3,
  rail_station: 1,
  district: 1,
};

export const TRANSIT_HUBS = [
  { slug: "istanbul-airport", city: "istanbul", kind: "airport", lat: 41.2617, lng: 28.7422 },
  // Yolcu terminali; pist referans noktasi (40.8986, 29.3092) degil.
  { slug: "sabiha-gokcen-airport", city: "istanbul", kind: "airport", lat: 40.9055, lng: 29.3165 },
  // Resmi adi Buyuk Istanbul Otogari (Bayrampasa); slug aranan halk adini tasir.
  { slug: "esenler-bus-terminal", city: "istanbul", kind: "bus_terminal", lat: 41.0386, lng: 28.8946 },
  { slug: "sogutlucesme", city: "istanbul", kind: "rail_station", lat: 40.9924, lng: 29.037 },
  // Eminonu'ne ~0,4 km: dizinde Eminonu kalir.
  { slug: "sirkeci", city: "istanbul", kind: "rail_station", lat: 41.0153, lng: 28.9772, indexable: false },
  { slug: "taksim", city: "istanbul", kind: "district", lat: 41.0369, lng: 28.9853 },
  { slug: "sultanahmet", city: "istanbul", kind: "district", lat: 41.0061, lng: 28.9759 },
  { slug: "kadikoy", city: "istanbul", kind: "district", lat: 40.9927, lng: 29.023 },
  { slug: "besiktas", city: "istanbul", kind: "district", lat: 41.0422, lng: 29.007 },
  { slug: "karakoy", city: "istanbul", kind: "district", lat: 41.0224, lng: 28.977 },
  { slug: "eminonu", city: "istanbul", kind: "district", lat: 41.0172, lng: 28.9727 },
  // Karakoy'e ~0,4 km: dizinde Karakoy kalir.
  { slug: "galata", city: "istanbul", kind: "district", lat: 41.0256, lng: 28.9742, indexable: false },
] as const satisfies readonly TransitHub[];

export type TransitHubSlug = (typeof TRANSIT_HUBS)[number]["slug"];

export function hubRadiusKm(hub: TransitHub): number {
  return hub.radiusKm ?? HUB_KIND_RADIUS_KM[hub.kind];
}

export function hubsForCity(citySlug: string): readonly TransitHub[] {
  return TRANSIT_HUBS.filter((h) => h.city === citySlug);
}

export function getTransitHub(citySlug: string, hubSlug: string): TransitHub | undefined {
  return TRANSIT_HUBS.find((h) => h.city === citySlug && h.slug === hubSlug);
}

export function hubPath(hub: Pick<TransitHub, "city" | "slug">): string {
  return `/luggage-storage/${hub.city}/${hub.slug}`;
}

export function hubCity(hub: TransitHub) {
  return STORAGE_CITIES.find((c) => c.slug === hub.city);
}
