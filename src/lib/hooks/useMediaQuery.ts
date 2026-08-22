"use client";

import { useSyncExternalStore } from "react";

/**
 * `matchMedia` ile tek bir yerleşim varyantı render etmek için.
 *
 * NEDEN: `hidden md:flex` / `md:hidden` ile iki varyantı aynı anda DOM'a koymak
 * içeriği ikiye katlar — ekran okuyucu ve testler iki başlık, iki liste görür;
 * veri iki kez render edilir. Sunucu anlık görüntüsü masaüstü kabul edilir;
 * CSS kesme noktaları yanlış varyantın hidrasyon öncesi görünmesini zaten engeller.
 */
export function useMediaQuery(query: string, serverDefault = true): boolean {
  return useSyncExternalStore(
    (onChange) => {
      const mql = window.matchMedia(query);
      mql.addEventListener("change", onChange);
      return () => mql.removeEventListener("change", onChange);
    },
    () => window.matchMedia(query).matches,
    () => serverDefault,
  );
}
