import { useQuery } from "@tanstack/react-query";
import type { QueryClient } from "@tanstack/react-query";
import type { StyleSpecification } from "@maplibre/maplibre-react-native";

/**
 * Harita altligi -- web'deki `src/lib/map-style.ts` ve Flutter'daki
 * `map_style.dart` ile AYNI kaynak: OpenFreeMap "bright".
 *
 * Neden Google Maps degil: anahtar istemiyor, istek limiti yok, ticari kullanima
 * acik (gerekce web dosyasinda kaynaklariyla yazili). Expo Go'nun gomulu Google
 * anahtari 2026-10-14'te emulatorde "Authorization failure" verdi; uretim icin
 * zaten ayri anahtar ve konsol ayari gerekecekti.
 */
export const MAP_STYLE_URL = "https://tiles.openfreemap.org/styles/bright";

/**
 * OSM verisi ODbL altinda; atif lisans SARTI, tercih degil. Stilin kendi
 * atfina guvenilmez (web'de bir kez sessizce kayboldu) -- ekranda sabit yazilir.
 */
export const MAP_ATTRIBUTION = "© OpenStreetMap · OpenFreeMap";

/*
  Stil JSON'u bir kez indirilir ve oturum boyunca tutulur. URL verilince
  MapLibre her harita acilisinda stili yeniden cekip ayristiriyordu: aramadan
  haritaya her geciste 1-2 sn bos zemin (2026-10-18 emulatorde goruldu).
  POI ve bina katmanlari ayiklanir: emanet noktasi secmek icin gereksiz,
  ama en cok cizim yukunu onlar getiriyor (119 katmanin 6'si). Yol, etiket,
  su ayni kaldigi icin altlik web ile ayni gorunur.
*/
const DROPPED_LAYER_PREFIXES = ["poi", "building"];

async function fetchMapStyle(): Promise<StyleSpecification> {
  const res = await fetch(MAP_STYLE_URL);
  if (!res.ok) throw new Error(`map_style_${res.status}`);
  const style = (await res.json()) as StyleSpecification;
  return {
    ...style,
    layers: style.layers.filter((l) => !DROPPED_LAYER_PREFIXES.some((p) => l.id.startsWith(p))),
  };
}

const mapStyleQuery = {
  queryKey: ["map-style"],
  queryFn: fetchMapStyle,
  staleTime: Infinity,
  gcTime: Infinity,
} as const;

/** Stil hazir degilse URL'ye duser; harita yine acilir, yalnizca hizlanma olmaz. */
export function useMapStyle(): string | StyleSpecification {
  return useQuery(mapStyleQuery).data ?? MAP_STYLE_URL;
}

/** Ana sayfada cagrilir: misafir haritaya gelene kadar stil inmis olur. */
export function prefetchMapStyle(client: QueryClient) {
  void client.prefetchQuery(mapStyleQuery).catch(() => undefined);
}
