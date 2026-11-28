import type { NextRequest } from "next/server";
import { authorizeCron } from "@/lib/internal-api-guard";

/**
 * Saglik uclarinin AYRINTISI yalnizca `CRON_SECRET` ile gelen istege verilir.
 *
 * NEDEN (2026-11-28 guvenlik taramasi): `/api/health/jobs` oturumsuz herkese muhur
 * stogunu, esnaf sayisini ve butun cron takvimini; `/api/health` Redis ve hiz siniri
 * kipini donduruyordu. Dis izleyicinin ihtiyaci durum kodu ve hangi kontrolun
 * bozuk oldugu; sayilar ve takvim degil.
 *
 * Sirsiz yanit: HTTP durumu ayni (200/503), her kontrolun yalnizca `status` alani
 * ve is basina `{ job, status }`. Tam govde: `X-Cron-Secret` ya da `Authorization: Bearer`.
 */
export function wantsHealthDetail(req: NextRequest | Request | undefined): boolean {
  if (!req) return false;
  return authorizeCron(req as NextRequest) === null;
}

type Check = { status?: unknown; jobs?: unknown };

/** Kontrol haritasini disariya acik bicime indirger. */
export function redactHealthChecks(checks: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [name, value] of Object.entries(checks)) {
    if (!value || typeof value !== "object") continue;
    const check = value as Check;
    const slim: Record<string, unknown> = { status: check.status ?? "unknown" };
    if (Array.isArray(check.jobs)) {
      slim.jobs = check.jobs.map((j: { job?: unknown; status?: unknown }) => ({ job: j.job, status: j.status }));
    }
    out[name] = slim;
  }
  return out;
}
