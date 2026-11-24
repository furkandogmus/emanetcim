import { normalizeTrGsm10 } from "./phone";

/** Pini olmayan dukkanin haritasi buradan acilir (Istanbul, Sultanahmet). */
export const DEFAULT_PIN_CENTER = { latitude: 41.0082, longitude: 28.9784 } as const;

export function hasPin(shop: { latitude?: number | null; longitude?: number | null }): boolean {
  const { latitude: lat, longitude: lng } = shop;
  return (
    typeof lat === "number" &&
    typeof lng === "number" &&
    Number.isFinite(lat) &&
    Number.isFinite(lng) &&
    Math.abs(lat) <= 90 &&
    Math.abs(lng) <= 180 &&
    !(lat === 0 && lng === 0)
  );
}

/** 6 ondalik ~11 cm: daha fazlasi gurultu, sunucuya da boyle gider. */
export function roundCoord(n: number): number {
  return Math.round(n * 1e6) / 1e6;
}

/**
 * SMS numarasi alaninin ne yapacagi. Numara ayni zamanda giris kimligi, bu
 * yuzden kayitli bir numarayi silmek ya da degistirmek onay ister.
 */
export type PhoneChange =
  | { kind: "none" }
  | { kind: "invalid" }
  | { kind: "save"; phone: string | null; confirm: "change" | "clear" | null };

export function phoneChange(current: string | null | undefined, input: string): PhoneChange {
  const stored = current ? (normalizeTrGsm10(current) ?? current) : null;
  const trimmed = input.trim();
  if (!trimmed) {
    return stored ? { kind: "save", phone: null, confirm: "clear" } : { kind: "none" };
  }
  const normalized = normalizeTrGsm10(trimmed);
  if (!normalized) return { kind: "invalid" };
  if (normalized === stored) return { kind: "none" };
  return { kind: "save", phone: normalized, confirm: stored ? "change" : null };
}

/** En yogun saat dilimi; hic veri yoksa null. Esitlikte erken saat. */
export function busiestHour(hours: { hour: string; count: number }[]): number | null {
  let best = -1;
  let max = 0;
  hours.forEach((h, i) => {
    if (h.count > max) {
      max = h.count;
      best = i;
    }
  });
  return best >= 0 ? best : null;
}
