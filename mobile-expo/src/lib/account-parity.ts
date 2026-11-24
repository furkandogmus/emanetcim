import { ApiError } from "./api";
import type { AdminAffiliateType, AffiliateApplication } from "./types";

/** `rate_limited` yanitindaki bir sonraki uygun an (sunucu denetim kaydindan hesaplar). */
export function dataExportRetryAt(err: unknown): string | null {
  if (!(err instanceof ApiError) || err.code !== "rate_limited") return null;
  const body = err.body;
  if (!body || typeof body !== "object") return null;
  const v = (body as { retryAt?: unknown }).retryAt;
  return typeof v === "string" && !Number.isNaN(Date.parse(v)) ? v : null;
}

/**
 * Basvuru formu: sunucu semasiyla ayni asgari kurallar (`AffiliateService.applicationSchema`).
 * Hata kodu `affiliate.errors.*` anahtaridir.
 */
export function buildAffiliateApplication(f: {
  displayName: string;
  type: AdminAffiliateType | null;
  email: string;
  phone: string;
  note: string;
}): { ok: true; body: AffiliateApplication } | { ok: false; error: "invalid_data" | "contact_required" } {
  const displayName = f.displayName.trim();
  if (displayName.length < 2 || !f.type) return { ok: false, error: "invalid_data" };
  const email = f.email.trim();
  const phone = f.phone.trim();
  if (!email && !phone) return { ok: false, error: "contact_required" };
  return {
    ok: true,
    body: {
      displayName,
      type: f.type,
      contactEmail: email || undefined,
      contactPhone: phone || undefined,
      applicationNote: f.note.trim() || undefined,
    },
  };
}
