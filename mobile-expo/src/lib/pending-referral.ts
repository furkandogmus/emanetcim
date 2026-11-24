import * as SecureStore from "expo-secure-store";

/**
 * Derin baglantidan gelen bekleyen kodlar. Web cereziyle ayni omur (30 gun); kodun
 * gecerliligine sunucu karar verir.
 *  - Araci kodu (`/shop/<id>?aff=KOD`): odeme ekrani "Referans kodu" alanina dolar.
 *  - Davet kodu (`/register?ref=KOD`, `ReferralCard` paylasimi): odeme ekraninin
 *    indirim kodu alanina dolar. Araci alanina tasinmaz: sunucu ikisini ayri kurallarla
 *    isler (`ReferralService`, `AffiliateService`).
 */
const TTL_MS = 30 * 24 * 60 * 60 * 1000;
const PATTERN = /^[A-Z0-9][A-Z0-9-]{1,30}[A-Z0-9]$/;

type Entry = { code: string; savedAt: number };

export function normalizeReferralCode(raw: string | null | undefined): string | null {
  const code = raw?.trim().toUpperCase() ?? "";
  return PATTERN.test(code) ? code : null;
}

function pendingCode(key: string) {
  let memory: Entry | null = null;
  return {
    remember(raw: string | null | undefined, now = Date.now()): void {
      const code = normalizeReferralCode(raw);
      if (!code) return;
      memory = { code, savedAt: now };
      // Depo yazilamazsa bellek bu oturum icin yeter.
      void SecureStore.setItemAsync(key, JSON.stringify(memory)).catch(() => undefined);
    },
    async load(now = Date.now()): Promise<string | null> {
      let entry = memory;
      if (!entry) {
        try {
          const raw = await SecureStore.getItemAsync(key);
          entry = raw ? (JSON.parse(raw) as Entry) : null;
        } catch {
          entry = null;
        }
      }
      if (!entry || typeof entry.code !== "string" || now - entry.savedAt > TTL_MS) return null;
      memory = entry;
      return entry.code;
    },
    clear(): void {
      memory = null;
      void SecureStore.deleteItemAsync(key).catch(() => undefined);
    },
  };
}

const affiliate = pendingCode("bp_pending_ref");
const invite = pendingCode("bp_pending_invite");

export const rememberReferral = affiliate.remember;
export const loadPendingReferral = affiliate.load;
export const clearPendingReferral = affiliate.clear;

export const rememberInvite = invite.remember;
export const loadPendingInvite = invite.load;
export const clearPendingInvite = invite.clear;
