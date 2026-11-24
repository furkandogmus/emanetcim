import * as SecureStore from "expo-secure-store";

/**
 * Afis atfi: uygulama `/shop/<id>?kaynak=afis-<dukkanId>` ile acildiysa 30 dk boyunca
 * checkout'a eklenir (son dokunus). Yalniz istatistik; sunucu bicimi, pencereyi ve dukkani
 * yeniden dogrular (`../src/lib/booking-source.ts`).
 */
export const POSTER_WINDOW_MS = 30 * 60 * 1000;
const KEY = "bp_pending_poster";
const SOURCE = /^afis-([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})$/i;

export type PosterAttribution = { shopId: string; capturedAt: string };

let memory: PosterAttribution | null = null;

export function rememberPosterSource(kaynak: string | null | undefined, now = Date.now()): void {
  const m = SOURCE.exec(kaynak?.trim() ?? "");
  if (!m) return;
  memory = { shopId: m[1].toLowerCase(), capturedAt: new Date(now).toISOString() };
  void SecureStore.setItemAsync(KEY, JSON.stringify(memory)).catch(() => undefined);
}

export async function loadPosterAttribution(now = Date.now()): Promise<PosterAttribution | null> {
  let entry = memory;
  if (!entry) {
    try {
      const raw = await SecureStore.getItemAsync(KEY);
      entry = raw ? (JSON.parse(raw) as PosterAttribution) : null;
    } catch {
      entry = null;
    }
  }
  if (!entry || typeof entry.shopId !== "string" || typeof entry.capturedAt !== "string") return null;
  const at = Date.parse(entry.capturedAt);
  if (!Number.isFinite(at) || now - at > POSTER_WINDOW_MS) return null;
  memory = entry;
  return entry;
}

export function clearPosterAttribution(): void {
  memory = null;
  void SecureStore.deleteItemAsync(KEY).catch(() => undefined);
}
