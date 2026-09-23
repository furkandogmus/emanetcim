/**
 * Davet linkindeki (`?ref=KOD`) kodu tarayicida saklar; odeme ekrani okur.
 *
 * NEDEN (2026-09-23): hesap sayfasi `/<dil>?ref=KOD` linki paylastiriyordu ama
 * `ref` parametresini hicbir sayfa okumuyordu -- davet edilen arkadas siteye
 * geliyor, kod kayboluyordu ve vaat edilen indirim hic uygulanmiyordu.
 *
 * localStorage erisimi gizli pencerede / engelli depoda firlatabilir; her
 * erisim try/catch icinde ve basarisizlik "kod yok" demektir.
 */
const STORAGE_KEY = "bagajpark_referral";
const TTL_MS = 30 * 24 * 60 * 60 * 1000;
const CODE_PATTERN = /^[A-Z0-9]{4,32}$/;

export function storeReferralCode(raw: string | null | undefined, now = Date.now()): void {
  const code = raw?.trim().toUpperCase();
  if (!code || !CODE_PATTERN.test(code)) return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ code, savedAt: now }));
  } catch {
    // depo yok: davet kodu bu oturumda elle girilebilir
  }
}

export function readReferralCode(now = Date.now()): string | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { code?: unknown; savedAt?: unknown };
    if (typeof parsed.code !== "string" || typeof parsed.savedAt !== "number") return null;
    if (now - parsed.savedAt > TTL_MS) {
      localStorage.removeItem(STORAGE_KEY);
      return null;
    }
    return parsed.code;
  } catch {
    return null;
  }
}

export function clearReferralCode(): void {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    // yoksay
  }
}
