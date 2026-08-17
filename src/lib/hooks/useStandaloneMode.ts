"use client";

import { useSyncExternalStore } from "react";

const STANDALONE_QUERY = "(display-mode: standalone)";

function subscribe(onChange: () => void): () => void {
  if (typeof window === "undefined") return () => {};
  const mq = window.matchMedia(STANDALONE_QUERY);
  mq.addEventListener("change", onChange);
  return () => mq.removeEventListener("change", onChange);
}

function getSnapshot(): boolean {
  if (typeof window === "undefined") return false;
  return (
    window.matchMedia(STANDALONE_QUERY).matches ||
    (window.navigator as { standalone?: boolean }).standalone === true
  );
}

/** Sunucuda standalone bilinemez; hydration uyuşmazlığı olmaması için false. */
function getServerSnapshot(): boolean {
  return false;
}

/**
 * PWA standalone modu. Effect içinde senkron setState yerine
 * useSyncExternalStore ile abone olunur (cascading render tetiklemez).
 */
export function useStandaloneMode() {
  const isStandalone = useSyncExternalStore(
    subscribe,
    getSnapshot,
    getServerSnapshot,
  );

  return { isStandalone };
}
