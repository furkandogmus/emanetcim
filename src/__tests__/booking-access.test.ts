import { describe, it, expect, vi } from "vitest";

const { memberFind } = vi.hoisted(() => ({ memberFind: vi.fn() }));
vi.mock("@/lib/db", () => ({ default: { shopMember: { findUnique: memberFind } } }));

import { canAccessBooking, canManageBookingAtShop, canOperateBookingAtShop } from "@/services/booking/access";

// Personel satiri yalnizca staff-1 / shop-1 icin var.
memberFind.mockImplementation(async ({ where }: { where: { shopId_userId: { shopId: string; userId: string } } }) =>
  where.shopId_userId.shopId === "shop-1" && where.shopId_userId.userId === "staff-1" ? { id: "m1" } : null,
);

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

const STAFF = { id: "staff-1", role: "GUEST" };

const BOOKING = { guestId: "guest-1", shop: { id: "shop-1", ownerId: "owner-1" } };
const GUEST_CHECKOUT = { guestId: null, shop: { id: "shop-1", ownerId: "owner-1" } };

describe("canAccessBooking", async () => {
  it("misafir kendi rezervasyonuna her iki modda da erişir", async () => {
    for (const allowShopPartner of [true, false]) {
      expect(await canAccessBooking(BOOKING, GUEST, { allowShopPartner })).toBe(true);
    }
  });

  it("admin her zaman erişir", async () => {
    expect(await canAccessBooking(BOOKING, ADMIN, { allowShopPartner: false })).toBe(true);
  });

  it("dükkan sahibi esnaf OKUR ama DEĞİŞTİREMEZ", async () => {
    // Esnafin iptal yolu "reddet"tir; buradan iptal edebilseydi iade ve slot
    // temizligi atlanirdi.
    expect(await canAccessBooking(BOOKING, OWNER, { allowShopPartner: true })).toBe(true);
    expect(await canAccessBooking(BOOKING, OWNER, { allowShopPartner: false })).toBe(false);
  });

  it("başka bir esnaf hiçbir modda erişemez", async () => {
    expect(await canAccessBooking(BOOKING, OTHER_PARTNER, { allowShopPartner: true })).toBe(false);
  });

  it("başka bir misafir erişemez", async () => {
    expect(
      await canAccessBooking(BOOKING, { id: "guest-2", role: "GUEST" }, { allowShopPartner: true }),
    ).toBe(false);
  });

  it("hesapsız misafir checkout'unda `guestId` null — kimse sahiplenemez", async () => {
    // `null === null` tuzagi: bos bir aktor id'si rezervasyonu ele geciremez.
    expect(
      await canAccessBooking(GUEST_CHECKOUT, { id: "", role: "GUEST" }, { allowShopPartner: false }),
    ).toBe(false);
    // Dukkan sahibi yine OKUYABILIR.
    expect(await canAccessBooking(GUEST_CHECKOUT, OWNER, { allowShopPartner: true })).toBe(true);
  });

  it("personel OKUR, değiştiremez; başka dükkanın personeli okuyamaz", async () => {
    expect(await canAccessBooking(BOOKING, STAFF, { allowShopPartner: true })).toBe(true);
    expect(await canAccessBooking(BOOKING, STAFF, { allowShopPartner: false })).toBe(false);
    const other = { ...BOOKING, shop: { id: "shop-2", ownerId: "owner-2" } };
    expect(await canAccessBooking(other, STAFF, { allowShopPartner: true })).toBe(false);
  });
});

describe("dükkan operasyonu ve yönetimi", () => {
  it("operate: sahip, personel, admin; başka esnaf ve misafir değil", async () => {
    expect(await canOperateBookingAtShop(BOOKING, OWNER)).toBe(true);
    expect(await canOperateBookingAtShop(BOOKING, STAFF)).toBe(true);
    expect(await canOperateBookingAtShop(BOOKING, ADMIN)).toBe(true);
    expect(await canOperateBookingAtShop(BOOKING, OTHER_PARTNER)).toBe(false);
    expect(await canOperateBookingAtShop(BOOKING, GUEST)).toBe(false);
  });

  it("manage: personel yönetemez (iptal)", () => {
    expect(canManageBookingAtShop(BOOKING, OWNER)).toBe(true);
    expect(canManageBookingAtShop(BOOKING, ADMIN)).toBe(true);
    expect(canManageBookingAtShop(BOOKING, STAFF)).toBe(false);
  });
});
