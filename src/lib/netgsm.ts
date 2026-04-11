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
  if (!isNetgsmConfigured()) {
    return { ok: false, error: "netgsm_not_configured" };
  }

  const msgheader = process.env.NETGSM_MSGHEADER!.trim();
  const text = params.message.replace(/\s+/g, " ").trim().slice(0, 900);

  try {
    const mod = await import("@netgsm/sms");
    const Netgsm = mod.default;
    const SendSmsErrorCode = mod.SendSmsErrorCode;

    const netgsm = new Netgsm({
      username: process.env.NETGSM_USERNAME!.trim(),
      password: process.env.NETGSM_PASSWORD!.trim(),
      appname: process.env.NETGSM_APPNAME?.trim() || undefined,
    });

    const res = await netgsm.sendRestSms({
      msgheader,
      encoding: "TR",
      messages: [{ msg: text, no: params.to10 }],
    });

    const success =
      res.code === SendSmsErrorCode.SUCCESS || String(res.code) === "00";
    if (success) {
      return { ok: true, jobId: res.jobid };
    }
    return {
      ok: false,
      error: `${res.code}: ${res.description ?? "netgsm_error"}`,
    };
  } catch (e) {
    const errMsg = e instanceof Error ? e.message : String(e);
    logger.error({ err: e }, "netgsm_send_exception");
    return { ok: false, error: errMsg };
  }
}
