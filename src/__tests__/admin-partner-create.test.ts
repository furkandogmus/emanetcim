import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * Admin'in esnaf adına hesap açması. Canlıda ilk örnekler (2026-09-29) elle SQL
 * ile açıldı; bu testler o yolun atladığı kuralları sabitliyor.
 */

const { mockAuth, mockService, mockAuditLog, mockResetLink } = vi.hoisted(() => ({
  mockAuth: vi.fn(),
  mockService: { createPartnerWithShop: vi.fn() },
  mockAuditLog: vi.fn(),
  mockResetLink: vi.fn(),
}));

vi.mock("@/auth", () => ({ auth: mockAuth }));
vi.mock("@/services/PartnerOnboardingService", () => ({
  partnerOnboardingService: mockService,
}));
vi.mock("@/lib/audit-log", () => ({ writeAuditLog: mockAuditLog }));
vi.mock("@/lib/partner-reset-link", () => ({ createPartnerResetLink: mockResetLink }));
vi.mock("@/lib/revalidate-locales", () => ({ revalidatePathAllLocales: vi.fn() }));
vi.mock("@/lib/client-ip", () => ({ getClientIpOrNull: vi.fn().mockResolvedValue(null) }));
vi.mock("@/lib/db", () => ({ default: {} }));

import { adminCreatePartnerAction } from "@/actions/admin-partner-create";

const VALID = {
  ownerName: "Merlin Home Tekstil",
  phone: "0545 519 10 39",
  email: "",
  shopName: "Merlin Home Tekstil",
  shopAddress: "Şekerhane Mah., Lale Sk. No:9, 07400 Alanya/Antalya",
  city: "Antalya",
  district: "Alanya",
  location: "https://maps.google.com/?q=36.54822699814878,31.998707814755914",
};

describe("adminCreatePartnerAction", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAuth.mockResolvedValue({ user: { id: "admin-1", role: "ADMIN" } });
    mockResetLink.mockResolvedValue({
      resetUrl: "https://bagajpark.com/tr/auth/new-password?token=SECRET-TOKEN",
      tokenFingerprint: "abc123def456",
      expiresAt: new Date("2026-09-30T12:00:00Z"),
    });
  });

  it("admin olmayan çağırana hiçbir şey açmaz", async () => {
    mockAuth.mockResolvedValue({ user: { id: "p-1", role: "PARTNER" } });

    const res = await adminCreatePartnerAction(VALID);

    expect(res.ok).toBe(false);
    expect(mockService.createPartnerWithShop).not.toHaveBeenCalled();
  });

  it("konum okunamazsa servise gitmez", async () => {
    const res = await adminCreatePartnerAction({ ...VALID, location: "Lale Sk. No:9" });

    expect(res).toEqual({ ok: false, error: "Errors.shopLocationRequired" });
    expect(mockService.createPartnerWithShop).not.toHaveBeenCalled();
  });

  it("konumu linkten okuyup servise sayı olarak geçirir ve şifre bağını döner", async () => {
    mockService.createPartnerWithShop.mockResolvedValue({
      ok: true,
      userId: "u-1",
      shopId: "s-1",
      phone: "5455191039",
    });

    const res = await adminCreatePartnerAction(VALID);

    expect(mockService.createPartnerWithShop).toHaveBeenCalledWith(
      expect.objectContaining({
        phone: "0545 519 10 39",
        email: null,
        latitude: 36.54822699814878,
        longitude: 31.998707814755914,
      }),
    );
    expect(mockResetLink).toHaveBeenCalledWith("5455191039");
    expect(res).toEqual({
      ok: true,
      shopId: "s-1",
      resetUrl: "https://bagajpark.com/tr/auth/new-password?token=SECRET-TOKEN",
    });
  });

  it("denetim kaydı token'ın kendisini değil parmak izini taşır", async () => {
    mockService.createPartnerWithShop.mockResolvedValue({
      ok: true,
      userId: "u-1",
      shopId: "s-1",
      phone: "5455191039",
    });

    await adminCreatePartnerAction(VALID);

    expect(mockAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "partner.created_by_admin",
        entityType: "Shop",
        entityId: "s-1",
        metadata: expect.objectContaining({ tokenFingerprint: "abc123def456" }),
      }),
    );
    expect(JSON.stringify(mockAuditLog.mock.calls)).not.toContain("SECRET-TOKEN");
  });

  it.each([
    ["phone_already_registered", "Errors.phoneAlreadyRegistered"],
    ["email_already_registered", "Errors.emailAlreadyRegistered"],
    ["invalid_tr_phone", "Errors.invalidTrPhone"],
  ])("servis %s derse %s döner, bağ üretmez", async (reason, error) => {
    mockService.createPartnerWithShop.mockResolvedValue({ ok: false, reason });

    const res = await adminCreatePartnerAction(VALID);

    expect(res).toEqual({ ok: false, error });
    expect(mockResetLink).not.toHaveBeenCalled();
    expect(mockAuditLog).not.toHaveBeenCalled();
  });
});
