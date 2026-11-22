import { describe, it, expect } from "vitest";
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
