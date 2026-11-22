import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

const { warn } = vi.hoisted(() => ({ warn: vi.fn() }));
vi.mock("@/lib/logger", () => ({ default: { warn, info: vi.fn(), error: vi.fn() } }));

import { POST } from "@/app/api/csp-report/route";

let ipSeq = 0;
function call(body: string, type: string, ip = `198.51.100.${++ipSeq}`) {
  return POST(
    new NextRequest("http://x/api/csp-report", {
      method: "POST",
      body,
      headers: { "content-type": type, "x-real-ip": ip },
    }),
  );
}

const legacy = JSON.stringify({
  "csp-report": {
    "document-uri": "https://bagajpark.com/tr/bookings/lookup?code=SECRET123",
    "effective-directive": "script-src-elem",
    "blocked-uri": "https://evil.example.com/x.js?token=abc",
    "script-sample": "alert('kullanici metni')",
    disposition: "report",
  },
});

const reportingApi = JSON.stringify([
  {
    type: "csp-violation",
    url: "https://bagajpark.com/tr/checkout/abc",
    body: {
      documentURL: "https://bagajpark.com/tr/checkout/abc",
      effectiveDirective: "require-trusted-types-for",
      blockedURL: "trusted-types-sink",
      disposition: "report",
    },
  },
  { type: "deprecation", body: {} },
]);

describe("/api/csp-report", () => {
  beforeEach(() => warn.mockClear());

  it("eski report-uri biçimini (application/csp-report) kabul eder ve yalnızca host + direktifi loglar", async () => {
    const res = await call(legacy, "application/csp-report");
    expect(res.status).toBe(204);
    expect(warn).toHaveBeenCalledTimes(1);
    const [fields] = warn.mock.calls[0];
    expect(fields.csp).toEqual({
      directive: "script-src-elem",
      blocked: "evil.example.com",
      disposition: "report",
    });
    // Belge adresi, sorgu dizesi ve script örneği log'a GİRMEZ.
    const logged = JSON.stringify(warn.mock.calls);
    expect(logged).not.toContain("SECRET123");
    expect(logged).not.toContain("token=abc");
    expect(logged).not.toContain("kullanici metni");
    expect(logged).not.toContain("bookings/lookup");
  });

  it("Reporting API biçimini (application/reports+json) kabul eder, csp-violation dışını atlar", async () => {
    const res = await call(reportingApi, "application/reports+json");
    expect(res.status).toBe(204);
    expect(warn).toHaveBeenCalledTimes(1);
    expect(warn.mock.calls[0][0].csp).toEqual({
      directive: "require-trusted-types-for",
      blocked: "trusted-types-sink",
      disposition: "report",
    });
    expect(JSON.stringify(warn.mock.calls)).not.toContain("checkout/abc");
  });

  it("alanları kırpar", async () => {
    const long = "x".repeat(5000);
    await call(
      JSON.stringify({ "csp-report": { "effective-directive": long, "blocked-uri": "inline" } }),
      "application/csp-report",
    );
    expect(warn.mock.calls[0][0].csp.directive.length).toBeLessThanOrEqual(128);
    expect(warn.mock.calls[0][0].csp.blocked).toBe("inline");
  });

  it("büyük gövdeyi reddeder (413) ve loglamaz", async () => {
    const big = JSON.stringify({ "csp-report": { "blocked-uri": "x".repeat(20 * 1024) } });
    const res = await call(big, "application/csp-report");
    expect(res.status).toBe(413);
    expect(warn).not.toHaveBeenCalled();
  });

  it("tanınmayan içerik türünü reddeder (415)", async () => {
    const res = await call(legacy, "text/plain");
    expect(res.status).toBe(415);
  });

  it("IP başına hız sınırı uygular (429)", async () => {
    const ip = "203.0.113.7";
    const statuses: number[] = [];
    for (let i = 0; i < 31; i++) statuses.push((await call(legacy, "application/csp-report", ip)).status);
    expect(statuses.slice(0, 30).every((s) => s === 204)).toBe(true);
    expect(statuses[30]).toBe(429);
    // Başka IP etkilenmez.
    expect((await call(legacy, "application/csp-report")).status).toBe(204);
  });
});
