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
  });

  it("/admin ve alt yollarini korumali sayar, ilgisiz yollari saymaz", () => {
    expect(isAdminPath("/admin")).toBe(true);
    expect(isAdminPath("/admin/messages")).toBe(true);
    expect(isAdminPath("/administration")).toBe(false);
  });

  /*
    2026-09-10'da bulundu: `/api/admin` ve `/api/partner` bu fonksiyonlarda
    ESKIDEN eslesiyordu ama `proxy.ts`teki `pathname.startsWith('/api/')` erken
    donusu yuzunden bu eslesme HICBIR ZAMAN role-kontrolu blogunda kullanilmiyordu
    -- olu kod, "middleware koruyor" yanilsamasi. Artik eslesmiyorlar (bkz.
    route-protection.ts); asagidaki test bunun BILEREK boyle oldugunu, gelecekte
    biri "unutulmus" sanip geri eklemesin diye sabitliyor.
  */
  it("/api/admin ve /api/partner'i ARTIK korumali saymaz (proxy'de zaten erisilemez yoldu)", () => {
    expect(isAdminPath("/api/admin")).toBe(false);
    expect(isAdminPath("/api/admin/messages")).toBe(false);
    expect(isPartnerPath("/api/partner")).toBe(false);
    expect(isPartnerPath("/api/partner/bookings")).toBe(false);
  });

  it("ilgisiz yollari korumali saymaz", () => {
    expect(isPartnerPath("/")).toBe(false);
    expect(isPartnerPath("/search")).toBe(false);
    expect(isAdminPath("/")).toBe(false);
  });
});
