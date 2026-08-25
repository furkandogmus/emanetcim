import { describe, it, expect } from "vitest";
import { canAccessBooking } from "@/services/booking/access";

/**
 * Rezervasyona erisim kurali — uc mobil ucun ORTAK kapisi.
 *
 * NEDEN (2026-08-26): kural uc yerde elle yaziliydi ve aralarinda KASITLI ama
 * YAZISIZ bir fark vardi: detay ucunda dukkan sahibi esnaf da okuyabiliyordu,
 * iptal/duzenleme uclarinda okuyamiyordu. Fark dogruydu — esnafin yolu
 * "reddet"tir ve o yol iadeyi + slot temizligini `cancelBooking` uzerinden
 * yurutur — ama uc kopyanin arasinda yazili degildi.
 */

const GUEST = { id: "guest-1", role: "GUEST" };
const OWNER = { id: "owner-1", role: "PARTNER" };
const OTHER_PARTNER = { id: "owner-2", role: "PARTNER" };
const ADMIN = { id: "admin-1", role: "ADMIN" };

const BOOKING = { guestId: "guest-1", shop: { ownerId: "owner-1" } };
const GUEST_CHECKOUT = { guestId: null, shop: { ownerId: "owner-1" } };

describe("canAccessBooking", () => {
  it("misafir kendi rezervasyonuna her iki modda da erişir", () => {
    for (const allowShopPartner of [true, false]) {
      expect(canAccessBooking(BOOKING, GUEST, { allowShopPartner })).toBe(true);
    }
  });

  it("admin her zaman erişir", () => {
    expect(canAccessBooking(BOOKING, ADMIN, { allowShopPartner: false })).toBe(true);
  });

  it("dükkan sahibi esnaf OKUR ama DEĞİŞTİREMEZ", () => {
    // Esnafin iptal yolu "reddet"tir; buradan iptal edebilseydi iade ve slot
    // temizligi atlanirdi.
    expect(canAccessBooking(BOOKING, OWNER, { allowShopPartner: true })).toBe(true);
    expect(canAccessBooking(BOOKING, OWNER, { allowShopPartner: false })).toBe(false);
  });

  it("başka bir esnaf hiçbir modda erişemez", () => {
    expect(canAccessBooking(BOOKING, OTHER_PARTNER, { allowShopPartner: true })).toBe(false);
  });

  it("başka bir misafir erişemez", () => {
    expect(
      canAccessBooking(BOOKING, { id: "guest-2", role: "GUEST" }, { allowShopPartner: true }),
    ).toBe(false);
  });

  it("hesapsız misafir checkout'unda `guestId` null — kimse sahiplenemez", () => {
    // `null === null` tuzagi: bos bir aktor id'si rezervasyonu ele geciremez.
    expect(
      canAccessBooking(GUEST_CHECKOUT, { id: "", role: "GUEST" }, { allowShopPartner: false }),
    ).toBe(false);
    // Dukkan sahibi yine OKUYABILIR.
    expect(canAccessBooking(GUEST_CHECKOUT, OWNER, { allowShopPartner: true })).toBe(true);
  });
});
