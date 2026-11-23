import * as SecureStore from "expo-secure-store";

/**
 * Derin baglantidaki araci kodu (`https://bagajpark.com/tr/shop/<id>?aff=KOD`).
 * Uygulama baglantiyi acarken yakalanir, odeme ekrani "Referans kodu" alanina
 * doldurur. Web cereziyle ayni omur (30 gun); kodun gecerliligine sunucu karar verir.
 */
const KEY = "bp_pending_ref";
const TTL_MS = 30 * 24 * 60 * 60 * 1000;
const PATTERN = /^[A-Z0-9][A-Z0-9-]{1,30}[A-Z0-9]$/;

let memory: { code: string; savedAt: number } | null = null;

export function normalizeReferralCode(raw: string | null | undefined): string | null {
  const code = raw?.trim().toUpperCase() ?? "";
  return PATTERN.test(code) ? code : null;
}

export function rememberReferral(raw: string | null | undefined, now = Date.now()): void {
  const code = normalizeReferralCode(raw);
  if (!code) return;
  memory = { code, savedAt: now };
  // Depo yazilamazsa bellek bu oturum icin yeter.
  void SecureStore.setItemAsync(KEY, JSON.stringify(memory)).catch(() => undefined);
}

export async function loadPendingReferral(now = Date.now()): Promise<string | null> {
  let entry = memory;
  if (!entry) {
    try {
      const raw = await SecureStore.getItemAsync(KEY);
      entry = raw ? (JSON.parse(raw) as { code: string; savedAt: number }) : null;
    } catch {
      entry = null;
    }
  }
  if (!entry || typeof entry.code !== "string" || now - entry.savedAt > TTL_MS) return null;
  memory = entry;
  return entry.code;
}

export function clearPendingReferral(): void {
  memory = null;
  void SecureStore.deleteItemAsync(KEY).catch(() => undefined);
}
