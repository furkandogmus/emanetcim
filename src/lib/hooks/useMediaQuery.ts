"use client";

import { useCallback, useSyncExternalStore } from "react";

/**
 * Bir CSS media query'sini dinler.
 *
 * Effect içinde senkron setState yerine useSyncExternalStore kullanır;
 * böylece cascading render tetiklenmez. Sunucuda daima `false` döner
 * (hydration uyuşmazlığını önlemek için).
 */
export function useMediaQuery(query: string): boolean {
  const subscribe = useCallback(
    (onChange: () => void) => {
      if (typeof window === "undefined") return () => {};
      const mq = window.matchMedia(query);
      mq.addEventListener("change", onChange);
      return () => mq.removeEventListener("change", onChange);
    },
    [query],
  );

  const getSnapshot = useCallback(() => {
    if (typeof window === "undefined") return false;
    return window.matchMedia(query).matches;
  }, [query]);

  return useSyncExternalStore(subscribe, getSnapshot, () => false);
}
