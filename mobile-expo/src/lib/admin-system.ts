import type { AdminHealthLevel, AdminSystem, AdminSystemCheck, AdminSystemJob } from "./types";

export type Tone = "ok" | "warning" | "danger" | "muted";

/** Cron'u kurulmamis (`enforced: false`) is gecikse de "bekliyor"dur, kirmizi degil (sunucu kurali). */
export function jobTone(j: Pick<AdminSystemJob, "status" | "enforced">): Tone {
  if (j.status === "ok") return "ok";
  return j.enforced ? "danger" : "muted";
}

export function checkTone(c: AdminSystemCheck, optional = false): Tone {
  if (c === "ok") return "ok";
  return optional ? "warning" : "danger";
}

/**
 * Ozet kartinin tek satiri: is gecikmesi saglik skorundan once gelir. Slot uretimi
 * durdugunda skor yesildi; gecikmis is varken "her sey yolunda" denmez.
 */
export function systemHeadline(s: Pick<AdminSystem, "healthLevel" | "enforcedStale">): AdminHealthLevel {
  if (s.enforcedStale > 0) return s.healthLevel === "error" ? "error" : "warning";
  return s.healthLevel;
}

