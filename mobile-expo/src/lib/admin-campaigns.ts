import type { AdminCampaign } from "./types";

/**
 * Kampanya formu. Dogrulamanin asli sunucuda (`../src/services/CampaignService.ts`);
 * burada yalniz dugmeyi acip kapatan kisim var.
 */
export type CampaignForm = { name: string; message: string; discount: string; endsAt: string };

export const EMPTY_CAMPAIGN_FORM: CampaignForm = { name: "", message: "", discount: "", endsAt: "" };

const DAY_RE = /^\d{4}-\d{2}-\d{2}$/;

/** Web formu `<input type="date">` degerini dogrudan `new Date()`e verir; ayni gun UTC gece yarisi. */
function dayToIso(day: string): string | null {
  if (!DAY_RE.test(day)) return null;
  const d = new Date(day);
  return Number.isNaN(d.getTime()) || d.toISOString().slice(0, 10) !== day ? null : d.toISOString();
}

function discountValue(raw: string): number | null {
  const v = raw.trim().replace(",", ".");
  if (!v) return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : NaN;
}

export function campaignToForm(c: AdminCampaign): CampaignForm {
  return {
    name: c.name,
    message: c.message ?? "",
    discount: c.discountPercent == null ? "" : String(c.discountPercent),
    endsAt: c.endsAt ? c.endsAt.slice(0, 10) : "",
  };
}

export function campaignFormIssues(f: CampaignForm): (keyof CampaignForm)[] {
  const out: (keyof CampaignForm)[] = [];
  if (!f.name.trim() || f.name.trim().length > 200) out.push("name");
  if (f.message.length > 1000) out.push("message");
  const d = discountValue(f.discount);
  if (d !== null && (Number.isNaN(d) || d < 0 || d > 100)) out.push("discount");
  if (f.endsAt.trim() && !dayToIso(f.endsAt.trim())) out.push("endsAt");
  return out;
}

/** POST ve duzenleme PATCH'i ayni govde: bos alan `null` (temizle) gider. */
export function campaignBody(f: CampaignForm) {
  return {
    name: f.name.trim(),
    message: f.message.trim() || null,
    discountPercent: discountValue(f.discount),
    endsAt: f.endsAt.trim() ? dayToIso(f.endsAt.trim()) : null,
  };
}

/** Bitis tarihi gecmisse kampanya acik gorunse de suresi dolmustur. */
export function isCampaignExpired(c: Pick<AdminCampaign, "endsAt">, now: Date = new Date()): boolean {
  return !!c.endsAt && new Date(c.endsAt).getTime() < now.getTime();
}
