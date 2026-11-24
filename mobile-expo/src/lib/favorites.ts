import { useCallback, useEffect, useSyncExternalStore } from "react";
import * as SecureStore from "expo-secure-store";

/**
 * Favori dukkanlar CIHAZDA (web `use-favorites` tarayicida tuttugu gibi): hesap
 * gerektirmez, sunucuya gitmez. Yalnizca kimlikler saklanir; ad, foto ve puan
 * dukkan ucundan taze okunur. SecureStore buyuk degerleri iOS'ta reddedebilir,
 * bu yuzden liste sinirli (40 x 36 karakter ~ 1.5 KB).
 */
const KEY = "bp_favorite_shops";
export const MAX_FAVORITES = 40;

/** En yeni basta; zaten varsa cikarilir. Sinir asilinca en eskisi duser. */
export function toggleFavoriteId(list: readonly string[], id: string, max = MAX_FAVORITES): string[] {
  if (list.includes(id)) return list.filter((x) => x !== id);
  return [id, ...list].slice(0, max);
}

/** Bozuk / eski kayit sessizce bos liste olur. */
export function parseFavorites(raw: string | null): string[] {
  if (!raw) return [];
  try {
    const v: unknown = JSON.parse(raw);
    if (!Array.isArray(v)) return [];
    return [...new Set(v.filter((x): x is string => typeof x === "string" && x.length > 0 && x.length <= 64))].slice(
      0,
      MAX_FAVORITES,
    );
  } catch {
    return [];
  }
}

let ids: string[] = [];
let loaded = false;
/** Okuma hata verdiyse depodaki liste bilinmiyor: ustune `[id]` yazilip silinmesin. */
let readFailed = false;
let loading: Promise<void> | null = null;
const listeners = new Set<() => void>();

function emit() {
  for (const l of listeners) l();
}

function load(): Promise<void> {
  if (loaded) return Promise.resolve();
  loading ??= SecureStore.getItemAsync(KEY).then(
    (raw) => {
      ids = parseFavorites(raw);
      loaded = true;
      emit();
    },
    () => {
      readFailed = true;
      loaded = true;
    },
  );
  return loading;
}

/** Once depo okunur: okuma bitmeden yapilan dokunus kayitli listeyi `[id]` ile ezmesin. */
export async function toggleFavorite(id: string): Promise<void> {
  await load();
  ids = toggleFavoriteId(ids, id);
  emit();
  // Okunamayan depoya yazilmaz; degisiklik bu oturumda bellekte kalir.
  if (readFailed) return;
  await SecureStore.setItemAsync(KEY, JSON.stringify(ids)).catch(() => undefined);
}

function subscribe(l: () => void) {
  listeners.add(l);
  return () => listeners.delete(l);
}

const snapshot = () => ids;

export function useFavorites() {
  const list = useSyncExternalStore(subscribe, snapshot, snapshot);
  useEffect(() => {
    void load();
  }, []);
  const isFavorite = useCallback((id: string) => list.includes(id), [list]);
  return { ids: list, isFavorite, toggle: toggleFavorite };
}

/** Yalnizca testler icin. */
export function __resetFavoritesForTest() {
  ids = [];
  loaded = false;
  readFailed = false;
  loading = null;
  listeners.clear();
}
