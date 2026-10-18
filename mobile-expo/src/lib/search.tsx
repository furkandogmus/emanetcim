import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { AppState } from "react-native";
import type { ReactNode } from "react";

import { wallInstant, wallParts } from "./time";

export type Place = { label: string; latitude: number; longitude: number; isCurrent?: boolean };
export type Bags = { s: number; m: number; xl: number };

/**
 * Sabit sehir listesi. Serbest metinle adres arama (geocode) web'de bir
 * server action; mobil API'de karsiligi yok. MVP bilerek sehir + "konumumu
 * kullan" ile sinirli.
 */
export const CITIES: Place[] = [
  { label: "İstanbul", latitude: 41.0165, longitude: 28.9765 },
  { label: "Bodrum", latitude: 37.035, longitude: 27.43 },
  { label: "Antalya", latitude: 36.8969, longitude: 30.7133 },
  { label: "İzmir", latitude: 38.4237, longitude: 27.1428 },
  { label: "Ankara", latitude: 39.9334, longitude: 32.8597 },
  { label: "Fethiye", latitude: 36.6216, longitude: 29.1164 },
  { label: "Paris", latitude: 48.8566, longitude: 2.3522 },
];

type SearchState = {
  place: Place | null;
  checkIn: Date;
  checkOut: Date;
  bags: Bags;
};

type SearchContextValue = SearchState & {
  setPlace: (p: Place) => void;
  setWindow: (checkIn: Date, checkOut: Date) => void;
  setBags: (b: Bags) => void;
};

/**
 * Varsayilan: bir sonraki tam saat ile dort saat sonrasi, bir orta valiz.
 * Dukkanlarin cogu 09:00-20:00 acik; gece/sabaha karsi aranirsa bir sonraki
 * 09:00'a kayar -- yoksa misafir 01:00-05:00 gibi kimsenin acik olmadigi bir
 * aralikla haritaya gelir ve "nokta yok" gorur.
 */
export function defaultWindow() {
  const now = wallParts(new Date());
  let hour = now.hour + 1;
  let day = now.day;
  if (hour < 8 || hour > 18) {
    if (hour > 18) day += 1;
    hour = 9;
  }
  const start = wallInstant(now.year, now.month, day, hour);
  return { checkIn: start, checkOut: new Date(start.getTime() + 4 * 60 * 60 * 1000) };
}

const SearchContext = createContext<SearchContextValue | null>(null);

export function SearchProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<SearchState>(() => ({
    place: null,
    ...defaultWindow(),
    bags: { s: 0, m: 1, xl: 0 },
  }));

  /*
    Pencere uygulama acilirken bir kez kuruluyordu. Uygulama arka planda
    birakma saatini gecince harita ayni gecmis tarihlerle istek atiyor, sunucu
    `invalid_dates` donuyor ve "Tekrar dene" de ayni istegi tekrarliyordu.
    On plana donuste gecmiste kalan pencere bir sonraki uygun saate kayar.
  */
  useEffect(() => {
    const freshen = () =>
      setState((s) => (s.checkIn.getTime() < Date.now() ? { ...s, ...defaultWindow() } : s));
    freshen();
    const sub = AppState.addEventListener("change", (st) => st === "active" && freshen());
    return () => sub.remove();
  }, []);

  const value = useMemo<SearchContextValue>(
    () => ({
      ...state,
      setPlace: (place) => setState((s) => ({ ...s, place })),
      setWindow: (checkIn, checkOut) => setState((s) => ({ ...s, checkIn, checkOut })),
      setBags: (bags) => setState((s) => ({ ...s, bags })),
    }),
    [state],
  );
  return <SearchContext.Provider value={value}>{children}</SearchContext.Provider>;
}

export function useSearch() {
  const ctx = useContext(SearchContext);
  if (!ctx) throw new Error("useSearch must be used inside SearchProvider");
  return ctx;
}

export function totalBags(b: Bags) {
  return b.s + b.m + b.xl;
}
