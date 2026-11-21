import type { GeocodeResult } from "@/lib/types";

export type GeocodeItem = NonNullable<GeocodeResult["items"]>[number];

/**
 * Nominatim'in `display_name`i ulke ve posta koduna kadar uzanir; haritanin
 * basliginda ilk iki parca yeter ("Kadikoy, Istanbul").
 */
export function shortLabel(label: string) {
  // Kapi numarasi gibi yalnizca rakamli parcalar etiket olmaz ("Hilton, 2, Cadde" -> "Hilton, Cadde").
  const parts = label.split(",").map((p) => p.trim()).filter((p) => p && !/^\d+[A-Za-z]?$/.test(p));
  return parts.slice(0, 2).join(", ") || label;
}

/** Sunucu baslik/alt baslik verdiyse onlar; eski sunucuda display_name'den turetilir. */
export function placeLines(place: GeocodeItem): { title: string; subtitle: string } {
  if (place.title) return { title: place.title, subtitle: place.subtitle ?? "" };
  return { title: shortLabel(place.label), subtitle: place.label };
}
