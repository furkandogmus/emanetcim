import { describe, it, expect, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { redactHealthChecks, wantsHealthDetail } from "@/lib/health-detail";

/** Saglik uclari sirsiz istege sayi ve takvim vermez (2026-11-28 guvenlik taramasi). */
describe("health-detail", () => {
  beforeEach(() => {
    process.env.CRON_SECRET = "s3cret-value";
  });

  const req = (headers: Record<string, string> = {}) => new NextRequest("http://localhost/api/health/jobs", { headers });

  it("sir yoksa ya da yanlissa ayrinti verilmez", () => {
    expect(wantsHealthDetail(undefined)).toBe(false);
    expect(wantsHealthDetail(req())).toBe(false);
    expect(wantsHealthDetail(req({ "x-cron-secret": "wrong" }))).toBe(false);
  });

  it("dogru sirla ayrinti verilir", () => {
    expect(wantsHealthDetail(req({ "x-cron-secret": "s3cret-value" }))).toBe(true);
    expect(wantsHealthDetail(req({ authorization: "Bearer s3cret-value" }))).toBe(true);
  });

  it("CRON_SECRET tanimsizsa ayrinti kapali kalir", () => {
    delete process.env.CRON_SECRET;
    expect(wantsHealthDetail(req({ "x-cron-secret": "" }))).toBe(false);
  });

  it("acik bicim yalnizca durumlari ve is adlarini tasir", () => {
    const slim = redactHealthChecks({
      sealIntegrity: { status: "ok", total: 1301, byStatus: { STOCK: 1241 } },
      scheduledJobs: { status: "stale", jobs: [{ job: "cleanup", cron: "23 3 * * *", lastSuccessAt: "x", status: "stale" }] },
    });
    expect(slim).toEqual({
      sealIntegrity: { status: "ok" },
      scheduledJobs: { status: "stale", jobs: [{ job: "cleanup", status: "stale" }] },
    });
  });
});
