import logger from "@/lib/logger";

/**
 * Netgsm REST API — kullanıcı adı / şifre panelden.
 * NETGSM_MSGHEADER: onaylı SMS başlığı (gönderici adı).
 *
 * `@netgsm/sms` yalnızca gönderim anında dinamik import edilir; env yoksa paket yüklenmez.
 */
export function isNetgsmConfigured(): boolean {
  return !!(
    process.env.NETGSM_USERNAME?.trim() &&
    process.env.NETGSM_PASSWORD?.trim() &&
    process.env.NETGSM_MSGHEADER?.trim()
  );
}

/** Türkiye GSM: 10 hane, 5 ile başlar (örn. 5XXXXXXXXX) */
export function normalizeTrGsm10(
  input: string | null | undefined,
): string | null {
  if (!input?.trim()) return null;
  let d = input.replace(/\D/g, "");
  if (d.startsWith("90") && d.length >= 12) d = d.slice(2);
  if (d.startsWith("0") && d.length === 11) d = d.slice(1);
  if (d.length === 10 && d.startsWith("5")) return d;
  return null;
}

/** Boş / sadece boşluk geçerli (silme); doluysa TR GSM olmalı */
export function isValidPartnerTrPhone(input: string | null | undefined): boolean {
  if (!input?.trim()) return true;
  return normalizeTrGsm10(input) !== null;
}

/** NETGSM_ADMIN_PHONES=5xxxxxxxxx,5yyyyyyyyy */
export function parseAdminGsmNumbers(): string[] {
  const raw = process.env.NETGSM_ADMIN_PHONES?.trim();
  if (!raw) return [];
  const out: string[] = [];
  for (const part of raw.split(/[,;\s]+/)) {
    const n = normalizeTrGsm10(part);
    if (n) out.push(n);
  }
  return [...new Set(out)];
}

export async function sendNetgsmRestSms(params: {
  to10: string;
  message: string;
}): Promise<{ ok: boolean; jobId?: string; error?: string }> {
  // SMS entegrasyonu geçici olarak devre dışı bırakıldı.
  return { ok: false, error: "sms_disabled" };
}
