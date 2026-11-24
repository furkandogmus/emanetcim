import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

/**
 * Mobil yonetici yazan uclari: kampanya CRUD ve sifirdan esnaf / misafiri esnafa cevirme.
 * Mobil uc ve web action AYNI servis govdesinden gecer; her yazma denetim kaydi birakir;
 * goruntuleme oturumu ve yonetici olmayan yazamaz.
 */
const { mockPrisma, mockRequireMobileUser, mockAudit, mockAuth, mockOnboarding, mockResetLink } = vi.hoisted(() => ({
  mockPrisma: {
    campaign: { findMany: vi.fn(), findUnique: vi.fn(), create: vi.fn(), update: vi.fn(), delete: vi.fn() },
  },
  mockRequireMobileUser: vi.fn(),
  mockAudit: vi.fn(),
  mockAuth: vi.fn(),
  mockOnboarding: { createPartnerWithShop: vi.fn(), convertGuestToPartner: vi.fn() },
  mockResetLink: vi.fn(),
}));
vi.mock("@/lib/db", () => ({ default: mockPrisma }));
vi.mock("@/lib/audit-log", () => ({ writeAuditLog: mockAudit }));
vi.mock("@/auth", () => ({ auth: mockAuth }));
vi.mock("@/lib/revalidate-locales", () => ({ revalidatePathAllLocales: vi.fn() }));
vi.mock("@/lib/client-ip", async (orig) => ({
  ...(await orig<typeof import("@/lib/client-ip")>()),
  getClientIpOrNull: vi.fn().mockResolvedValue(null),
}));
vi.mock("@/services/PartnerOnboardingService", () => ({ partnerOnboardingService: mockOnboarding }));
vi.mock("@/lib/partner-reset-link", () => ({ createPartnerResetLink: mockResetLink }));
vi.mock("@/lib/mobile-auth", async (orig) => ({
  ...(await orig<typeof import("@/lib/mobile-auth")>()),
  requireMobileUser: mockRequireMobileUser,
}));

import { Prisma } from "@prisma/client";
import * as campaignsRoot from "@/app/api/mobile/admin/campaigns/route";
import * as campaignOne from "@/app/api/mobile/admin/campaigns/[id]/route";
import * as partnersRoute from "@/app/api/mobile/admin/partners/route";
import { createCampaignAction, deleteCampaignAction } from "@/actions/admin";
import { adminConvertGuestToPartnerAction } from "@/actions/admin-user-account";

const ADMIN = { id: "a1", role: "ADMIN" as const, email: "a@x.com" };
function req(path: string, method = "GET", body?: unknown) {
  return new NextRequest(`https://bagajpark.com/api/mobile/admin${path}`, {
    method,
    headers: { authorization: "Bearer t", "content-type": "application/json" },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
}
const p = (id: string) => ({ params: Promise.resolve({ id }) });
const json = async (r: Response | undefined) => ({ status: r!.status, body: await r!.json() });
const auditActions = () => mockAudit.mock.calls.map((c) => (c[0] as { action: string }).action);

const CAMPAIGN = {
  id: "c1",
  name: "Yaz",
  message: null,
  discountPercent: 10,
  isActive: true,
  startsAt: null,
  endsAt: null,
  createdAt: new Date("2026-11-01T10:00:00Z"),
};
const SHOP_BODY = {
  phone: "0555 000 00 00",
  shopName: "Ornek Bufe",
  shopAddress: "Ornek Mah. Deneme Sk. No:1",
  city: "Antalya",
  district: "Alanya",
  location: "36.5482, 31.9987",
};
const GUEST_ID = "6f1c2a52-6d9e-4a52-9a43-0d3f0c4f1a11";

beforeEach(() => {
  vi.clearAllMocks();
  mockRequireMobileUser.mockResolvedValue({ user: ADMIN });
  mockAuth.mockResolvedValue({ user: { id: "a1", role: "ADMIN" } });
  mockPrisma.campaign.findMany.mockResolvedValue([CAMPAIGN]);
  mockPrisma.campaign.findUnique.mockResolvedValue({ id: "c1", name: "Yaz" });
  mockPrisma.campaign.create.mockResolvedValue({ id: "c2" });
  mockPrisma.campaign.update.mockResolvedValue({});
  mockPrisma.campaign.delete.mockResolvedValue({});
  mockResetLink.mockResolvedValue({
    resetUrl: "https://bagajpark.com/tr/auth/new-password?token=T",
    tokenFingerprint: "fp",
    expiresAt: new Date("2026-11-25T10:00:00Z"),
  });
  mockOnboarding.createPartnerWithShop.mockResolvedValue({ ok: true, userId: "u9", shopId: "s9", phone: "5550000000" });
  mockOnboarding.convertGuestToPartner.mockResolvedValue({ ok: true, shopId: "s8", phone: "5550000000", hasPassword: true });
});

const WRITES: [string, () => Promise<Response | undefined>][] = [
  ["POST campaigns", () => campaignsRoot.POST(req("/campaigns", "POST", { name: "Kis" }))],
  ["PATCH campaigns/:id", () => campaignOne.PATCH(req("/campaigns/c1", "PATCH", { isActive: false }), p("c1"))],
  ["DELETE campaigns/:id", () => campaignOne.DELETE(req("/campaigns/c1", "DELETE"), p("c1"))],
  ["POST partners", () => partnersRoute.POST(req("/partners", "POST", { ownerName: "Ali Veli", ...SHOP_BODY }))],
];

const NO_WRITES = () => {
  expect(mockPrisma.campaign.create).not.toHaveBeenCalled();
  expect(mockPrisma.campaign.update).not.toHaveBeenCalled();
  expect(mockPrisma.campaign.delete).not.toHaveBeenCalled();
  expect(mockOnboarding.createPartnerWithShop).not.toHaveBeenCalled();
  expect(mockAudit).not.toHaveBeenCalled();
};

describe("yetki", () => {
  it.each(WRITES)("%s: yonetici olmayan 403, yazma yok", async (_n, call) => {
    mockRequireMobileUser.mockResolvedValue({ user: { ...ADMIN, role: "PARTNER" } });
    expect(await json(await call())).toEqual({ status: 403, body: { error: "forbidden" } });
    NO_WRITES();
  });

  it.each(WRITES)("%s: goruntuleme oturumunda 403", async (_n, call) => {
    mockRequireMobileUser.mockResolvedValue({ user: { ...ADMIN, role: "GUEST", impersonatedBy: "a0" } });
    expect(await json(await call())).toEqual({ status: 403, body: { error: "not_allowed_while_impersonating" } });
    NO_WRITES();
  });

  it("liste yonetici olmayana kapali", async () => {
    mockRequireMobileUser.mockResolvedValue({ user: { ...ADMIN, role: "GUEST" } });
    expect((await campaignsRoot.GET(req("/campaigns")))!.status).toBe(403);
  });
});

describe("kampanyalar", () => {
  it("liste govdesi DTO'dan gelir", async () => {
    const r = await json(await campaignsRoot.GET(req("/campaigns")));
    expect(r.body.items[0]).toEqual({
      id: "c1",
      name: "Yaz",
      message: null,
      discountPercent: 10,
      isActive: true,
      startsAt: null,
      endsAt: null,
      createdAt: "2026-11-01T10:00:00.000Z",
    });
  });

  it("olusturma ISO bitis tarihini kabul eder ve denetim kaydi yazar", async () => {
    const r = await json(
      await campaignsRoot.POST(
        req("/campaigns", "POST", { name: "Kis", discountPercent: 15, endsAt: "2026-12-31T21:00:00.000Z" }),
      ),
    );
    expect(r).toEqual({ status: 201, body: { id: "c2" } });
    expect(mockPrisma.campaign.create.mock.calls[0][0].data.endsAt).toEqual(new Date("2026-12-31T21:00:00.000Z"));
    expect(auditActions()).toEqual(["campaign.create"]);
  });

  it("gecersiz govde 400, yazma yok", async () => {
    const r = await json(await campaignsRoot.POST(req("/campaigns", "POST", { name: "", discountPercent: 150 })));
    expect(r).toEqual({ status: 400, body: { error: "invalid_data" } });
    NO_WRITES();
  });

  it("yalniz isActive degisirse duraklat/surdur olarak kaydedilir; duzenleme alan listesini yazar", async () => {
    await campaignOne.PATCH(req("/campaigns/c1", "PATCH", { isActive: false }), p("c1"));
    await campaignOne.PATCH(req("/campaigns/c1", "PATCH", { isActive: true }), p("c1"));
    await campaignOne.PATCH(req("/campaigns/c1", "PATCH", { name: "Yeni", discountPercent: null }), p("c1"));
    expect(auditActions()).toEqual(["campaign.pause", "campaign.resume", "campaign.update"]);
    expect(mockAudit.mock.calls[2][0].metadata).toEqual({ fields: ["name", "discountPercent"] });
  });

  it("bos PATCH ve olmayan kayit reddedilir", async () => {
    expect((await json(await campaignOne.PATCH(req("/campaigns/c1", "PATCH", {}), p("c1")))).status).toBe(400);
    mockPrisma.campaign.findUnique.mockResolvedValue(null);
    expect(await json(await campaignOne.DELETE(req("/campaigns/zz", "DELETE"), p("zz")))).toEqual({
      status: 404,
      body: { error: "not_found" },
    });
    NO_WRITES();
  });

  it("okuma ile yazma arasinda silinen kayit 500 degil 404 not_found (P2025)", async () => {
    const gone = new Prisma.PrismaClientKnownRequestError("Record not found", { code: "P2025", clientVersion: "test" });
    mockPrisma.campaign.update.mockRejectedValueOnce(gone);
    expect(await json(await campaignOne.PATCH(req("/campaigns/c1", "PATCH", { isActive: false }), p("c1")))).toEqual({
      status: 404,
      body: { error: "not_found" },
    });
    mockPrisma.campaign.delete.mockRejectedValueOnce(gone);
    expect(await json(await campaignOne.DELETE(req("/campaigns/c1", "DELETE"), p("c1")))).toEqual({
      status: 404,
      body: { error: "not_found" },
    });
    expect(mockAudit).not.toHaveBeenCalled();
    mockPrisma.campaign.delete.mockRejectedValueOnce(gone);
    await expect(deleteCampaignAction("c1")).rejects.toThrow("not_found");
  });

  it("web action'lari ayni govdeden gecer (denetim kaydi dahil); sil basarisizlikta firlatir", async () => {
    expect(await createCampaignAction({ name: "Web", endsAt: new Date("2026-12-01T00:00:00Z") })).toEqual({ success: true });
    expect(auditActions()).toEqual(["campaign.create"]);
    mockPrisma.campaign.findUnique.mockResolvedValue(null);
    await expect(deleteCampaignAction("zz")).rejects.toThrow("not_found");
  });
});

describe("esnaf olustur", () => {
  it("sifirdan: hesap + dukkan acar, sifre bagi doner, denetim kaydi yazar", async () => {
    const r = await json(
      await partnersRoute.POST(req("/partners", "POST", { ownerName: "Ali Veli", email: "", ...SHOP_BODY })),
    );
    expect(r).toEqual({
      status: 201,
      body: { userId: "u9", shopId: "s9", phone: "5550000000", resetUrl: "https://bagajpark.com/tr/auth/new-password?token=T" },
    });
    expect(mockOnboarding.createPartnerWithShop.mock.calls[0][0]).toMatchObject({
      ownerName: "Ali Veli",
      email: null,
      latitude: 36.5482,
      longitude: 31.9987,
      actor: { id: "a1", role: "ADMIN" },
    });
    expect(auditActions()).toEqual(["partner.created_by_admin"]);
  });

  it("koordinat cozulemezse 400 location_required, hesap acilmaz", async () => {
    const r = await json(
      await partnersRoute.POST(req("/partners", "POST", { ownerName: "Ali Veli", ...SHOP_BODY, location: "Lale Sk." })),
    );
    expect(r).toEqual({ status: 400, body: { error: "location_required" } });
    expect(mockOnboarding.createPartnerWithShop).not.toHaveBeenCalled();
  });

  it("telefon kayitliysa 409", async () => {
    mockOnboarding.createPartnerWithShop.mockResolvedValue({ ok: false, reason: "phone_already_registered" });
    const r = await json(await partnersRoute.POST(req("/partners", "POST", { ownerName: "Ali Veli", ...SHOP_BODY })));
    expect(r).toEqual({ status: 409, body: { error: "phone_already_registered" } });
    expect(mockAudit).not.toHaveBeenCalled();
  });

  it("tanimadik alan reddedilir", async () => {
    const r = await json(await partnersRoute.POST(req("/partners", "POST", { ...SHOP_BODY, role: "ADMIN" })));
    expect(r).toEqual({ status: 400, body: { error: "invalid_data" } });
  });

  it("fromUserId: misafiri cevirir, yeni hesap acmaz; sifresi olan hesaba bag uretilmez", async () => {
    const r = await json(await partnersRoute.POST(req("/partners", "POST", { fromUserId: GUEST_ID, ...SHOP_BODY })));
    expect(r.status).toBe(201);
    expect(r.body).toEqual({ userId: GUEST_ID, shopId: "s8", phone: "5550000000", resetUrl: null });
    expect(mockOnboarding.createPartnerWithShop).not.toHaveBeenCalled();
    expect(mockOnboarding.convertGuestToPartner.mock.calls[0][0]).toMatchObject({ userId: GUEST_ID });
    expect(mockResetLink).not.toHaveBeenCalled();
    expect(auditActions()).toEqual(["user.converted_to_partner"]);
  });

  it("misafir olmayan hesap 409 not_guest; web action ayni sonucu kendi anahtariyla verir", async () => {
    mockOnboarding.convertGuestToPartner.mockResolvedValue({ ok: false, reason: "not_guest" });
    const r = await json(await partnersRoute.POST(req("/partners", "POST", { fromUserId: GUEST_ID, ...SHOP_BODY })));
    expect(r).toEqual({ status: 409, body: { error: "not_guest" } });
    expect(await adminConvertGuestToPartnerAction({ userId: GUEST_ID, ...SHOP_BODY })).toEqual({
      ok: false,
      error: "Errors.userNotGuest",
    });
  });
});
