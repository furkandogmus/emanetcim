import { describe, it, expect, vi, afterEach } from "vitest";
import nextConfig from "../../next.config";
import { analyticsSessionCookie } from "@/lib/analytics-client";

/**
 * Güvenlik başlıkları ve analitik çerez bayrakları.
 * COOP `same-origin`: OAuth yönlendirme tabanlı olduğu için açılır pencere
 * gerekmiyor (bkz. next.config.ts).
 */
describe("güvenlik başlıkları", () => {
  it("tüm yollarda Cross-Origin-Opener-Policy: same-origin", async () => {
    const rules = (await nextConfig.headers?.()) ?? [];
    const all = rules.find((r) => r.source === "/:path*");
    const coop = all?.headers.find((h) => h.key === "Cross-Origin-Opener-Policy");
    expect(coop?.value).toBe("same-origin");
  });
});

/**
 * Report-Only eklenirken ZORUNLU CSP'nin tek baytı bile değişmemeli: o değişiklik
 * bu PR'ın kapsamı değil ve sessizce gevşerse hiçbir test fark etmezdi.
 * Beklenen değerler bu PR'dan önceki `main`den (9e14d604) birebir alındı.
 */
const ENFORCED_PRODUCTION =
  "default-src 'self'; script-src 'self' 'unsafe-inline' https://plausible.io https://static.cloudflareinsights.com https://*.crisp.chat; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com https://*.crisp.chat; img-src 'self' data: blob: https:; font-src 'self' data: https://fonts.gstatic.com https://*.crisp.chat; connect-src 'self' https://tiles.openfreemap.org https://nominatim.openstreetmap.org https://plausible.io https://static.cloudflareinsights.com https://*.crisp.chat wss://*.relay.crisp.chat wss://*.relay.rescue.crisp.chat; worker-src 'self' blob:; frame-ancestors 'none'; base-uri 'self'; form-action 'self'";
const ENFORCED_DEV = ENFORCED_PRODUCTION.replace("'unsafe-inline' https://plausible.io", "'unsafe-inline' 'unsafe-eval' https://plausible.io");

async function headersFor(nodeEnv: string) {
  vi.resetModules();
  vi.stubEnv("NODE_ENV", nodeEnv);
  const mod = await import("../../next.config");
  const rules = (await mod.default.headers?.()) ?? [];
  const all = rules.find((r) => r.source === "/:path*");
  const get = (key: string) => all?.headers.find((h) => h.key === key)?.value;
  return { get, keys: all?.headers.map((h) => h.key) ?? [] };
}

describe("CSP: zorunlu + yalnızca rapor", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("zorunlu CSP üretimde bayt bayt aynı", async () => {
    const h = await headersFor("production");
    expect(h.get("Content-Security-Policy")).toBe(ENFORCED_PRODUCTION);
    expect(h.keys.filter((k) => k === "Content-Security-Policy")).toHaveLength(1);
  });

  it("zorunlu CSP geliştirmede bayt bayt aynı", async () => {
    const h = await headersFor("development");
    expect(h.get("Content-Security-Policy")).toBe(ENFORCED_DEV);
  });

  it("Report-Only: script-src'de 'unsafe-inline' yok, sıkı direktifler ve rapor ucu var", async () => {
    const h = await headersFor("production");
    const ro = h.get("Content-Security-Policy-Report-Only");
    expect(ro).toBeTruthy();
    const directives = new Map(
      (ro ?? "").split("; ").map((d) => [d.split(" ")[0], d.split(" ").slice(1)] as const),
    );
    expect(directives.get("script-src")).not.toContain("'unsafe-inline'");
    expect(directives.get("script-src")).toContain("'self'");
    expect(directives.get("object-src")).toEqual(["'none'"]);
    expect(directives.get("base-uri")).toEqual(["'self'"]);
    expect(directives.get("require-trusted-types-for")).toEqual(["'script'"]);
    expect(directives.get("report-uri")).toEqual(["/api/csp-report"]);
    expect(directives.get("report-to")).toEqual(["csp-endpoint"]);
    expect(h.get("Reporting-Endpoints")).toBe('csp-endpoint="/api/csp-report"');
  });
});

describe("analitik oturum çerezi", () => {
  it("HTTPS'te Secure ve SameSite=Lax taşır", () => {
    const c = analyticsSessionCookie("abc", true);
    expect(c).toMatch(/;\s*Secure(;|$)/);
    expect(c).toMatch(/;\s*SameSite=Lax/);
    expect(c.startsWith("bp_analytics_sid=abc;")).toBe(true);
  });

  it("yerel HTTP'de Secure eklenmez (tarayıcı çerezi yazmazdı)", () => {
    expect(analyticsSessionCookie("abc", false)).not.toMatch(/Secure/);
  });
});
