import { describe, it, expect } from "vitest";
import { isAdminPath, isPartnerPath } from "@/lib/route-protection";

describe("route-protection", () => {
  it("/partners herkese acik tanitim sayfasini korumali sanmaz", () => {
    // Bu gercek bir bugtu: proxy.ts `startsWith("/partner")` kullaniyordu,
    // bu da "/partners" ile de eslesip anonim ziyaretcileri Header/Footer/
    // FAQ'dan baglanan herkese acik tanitim sayfasindan login'e atiyordu.
    expect(isPartnerPath("/partners")).toBe(false);
    expect(isPartnerPath("/partners/")).toBe(false);
  });

  it("/partner ve alt yollarini korumali sayar", () => {
    expect(isPartnerPath("/partner")).toBe(true);
    expect(isPartnerPath("/partner/bookings")).toBe(true);
    expect(isPartnerPath("/api/partner")).toBe(true);
    expect(isPartnerPath("/api/partner/bookings")).toBe(true);
  });

  it("/admin ve alt yollarini korumali sayar, ilgisiz yollari saymaz", () => {
    expect(isAdminPath("/admin")).toBe(true);
    expect(isAdminPath("/admin/messages")).toBe(true);
    expect(isAdminPath("/api/admin")).toBe(true);
    expect(isAdminPath("/administration")).toBe(false);
  });

  it("ilgisiz yollari korumali saymaz", () => {
    expect(isPartnerPath("/")).toBe(false);
    expect(isPartnerPath("/search")).toBe(false);
    expect(isAdminPath("/")).toBe(false);
  });
});
