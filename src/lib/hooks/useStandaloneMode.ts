"use client";

import { useSyncExternalStore } from "react";

function subscribe(onChange: () => void) {
  if (typeof window === "undefined") return () => {};
  const mq = window.matchMedia("(display-mode: standalone)");
  mq.addEventListener("change", onChange);
  return () => mq.removeEventListener("change", onChange);
}

function getSnapshot() {
  if (typeof window === "undefined") return false;
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    (window.navigator as { standalone?: boolean }).standalone === true
  );
}

function getServerSnapshot() {
  return false;
}

export function useStandaloneMode() {
  const isStandalone = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  return { isStandalone };
}
