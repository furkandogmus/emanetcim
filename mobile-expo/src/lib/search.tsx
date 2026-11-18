import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { AppState } from "react-native";
import type { ReactNode } from "react";

import { wallInstant, wallParts } from "./time";

/** `radiusM`: sehir kartindan gelince sehrin tamami; yoksa haritanin varsayilani. */
export type Place = { label: string; latitude: number; longitude: number; isCurrent?: boolean; radiusM?: number };
export type Bags = { s: number; m: number; xl: number };

// Sehir listesi sunucudan gelir (`useCities`, GET /cities): yalnizca dukkani olan sehirler.

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

    On planda saatlerce acik kalan uygulamada da ayni sey oluyordu (2026-10-18,
    emulatorde sihirbaz 09:00'u secili ama devre disi gosterdi, "Devam" kilitli
    kaldi): on plandayken de dakikada bir bakilir.
  */
  useEffect(() => {
    /*
      Yalnizca BIRAKMA ileri kayar; secilen alis hala gecerliyse (yeni birakistan en az
      bir saat sonra) korunur. Eskiden tum pencere varsayilana (4 saat) donuyordu:
      "bugun 14:30 -> 3 gun sonra" secen misafirin cok gunluk secimi sessizce kayboluyordu.
    */
    const freshen = () =>
      setState((s) => {
        if (s.checkIn.getTime() >= Date.now()) return s;
        const next = defaultWindow();
        const keepPickup = s.checkOut.getTime() - next.checkIn.getTime() >= 60 * 60 * 1000;
        return { ...s, checkIn: next.checkIn, checkOut: keepPickup ? s.checkOut : next.checkOut };
      });
    freshen();
    const timer = setInterval(freshen, 60_000);
    const sub = AppState.addEventListener("change", (st) => st === "active" && freshen());
    return () => {
      clearInterval(timer);
      sub.remove();
    };
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
