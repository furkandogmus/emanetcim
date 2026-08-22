import { describe, it, expect } from "vitest";
import { resolveLoginLanding, defaultLandingForRole } from "@/lib/auth-landing";

/**
 * Giriş sonrası yönlendirme.
 *
 * Neden test edilir: 2026-08-22'de e-postayla kayıtlı bir esnaf MİSAFİR sekmesinden
 * giriş yapabiliyordu ama ardından esnaf paneline değil misafir ana sayfasına
 * düşüyordu (P1-16). Varış noktasının ROLDEN türemesi bu davranışın sözleşmesidir.
 */

describe("resolveLoginLanding", () => {
  it("rolün kendi ana sayfasına götürür", () => {
    expect(resolveLoginLanding(null, "PARTNER")).toBe("/partner");
    expect(resolveLoginLanding(null, "ADMIN")).toBe("/admin");
    expect(resolveLoginLanding(null, "USER")).toBe("/");
  });

  it("bilinmeyen veya eksik rol misafir gibi ele alınır", () => {
    expect(resolveLoginLanding(null, undefined)).toBe("/");
    expect(resolveLoginLanding(null, "SOMETHING_NEW")).toBe("/");
  });

  it("kullanıcının gitmek istediği yer rolden ÖNCE gelir", () => {
    // Korumalı bir sayfadan yönlendirilmişse oraya dönmeli.
    expect(resolveLoginLanding("/bookings/abc", "PARTNER")).toBe("/bookings/abc");
    expect(resolveLoginLanding("/admin/disputes", "ADMIN")).toBe("/admin/disputes");
  });

  it('"/" hedef belirtilmedi demektir — rol devreye girer', () => {
    // sanitizeAuthCallbackUrl gecersiz/harici URL'leri "/" ye indirger.
    expect(resolveLoginLanding("/", "PARTNER")).toBe("/partner");
    expect(resolveLoginLanding("   ", "PARTNER")).toBe("/partner");
    expect(resolveLoginLanding("", "ADMIN")).toBe("/admin");
  });

  it("P1-16 senaryosu: e-postayla kayıtlı esnaf MİSAFİR sekmesinden girer, panele düşer", () => {
    // Sekme hicbir sekilde girdi degil: yalnizca rol ve callbackUrl.
    expect(resolveLoginLanding(null, "PARTNER")).toBe("/partner");
  });

  it("defaultLandingForRole tek kaynak — rol eşlemesi burada", () => {
    expect(defaultLandingForRole("PARTNER")).toBe("/partner");
    expect(defaultLandingForRole("ADMIN")).toBe("/admin");
    expect(defaultLandingForRole("USER")).toBe("/");
    expect(defaultLandingForRole(null)).toBe("/");
  });
});
