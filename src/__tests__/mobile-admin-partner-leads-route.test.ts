import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextResponse } from "next/server";

const { svc, auth } = vi.hoisted(() => ({
  svc: { convertToPartner: vi.fn(), list: vi.fn() },
  auth: {
    requireMobileUser: vi.fn(),
    requireRole: vi.fn(),
    forbidWhileImpersonating: vi.fn(),
  },
}));
vi.mock("@/lib/mobile-auth", () => auth);
vi.mock("@/services/PartnerLeadService", async () => {
  const real = await vi.importActual<typeof import("@/services/PartnerLeadService")>("@/services/PartnerLeadService");
  return { leadConversionDraft: real.leadConversionDraft, partnerLeadService: svc };
});
vi.mock("@/services/ShopService", () => ({ shopService: {} }));
vi.mock("@/services/NotificationService", () => ({ notificationService: {} }));
vi.mock("@/lib/partner-reset-link", () => ({ createPartnerResetLink: vi.fn() }));
vi.mock("@/lib/revalidate-locales", () => ({ revalidatePathAllLocales: vi.fn() }));
vi.mock("@/lib/db", () => ({ default: {} }));

import { GET } from "@/app/api/mobile/admin/partner-leads/route";
import { POST } from "@/app/api/mobile/admin/partner-leads/[id]/convert/route";

const convert = (body: unknown) =>
  POST(
    new Request("http://x/api/mobile/admin/partner-leads/l1/convert", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    }) as never,
    { params: Promise.resolve({ id: "lead-0000001" }) },
  );

const LEAD = {
  id: "lead-0000001",
  fullName: "Deneme Esnaf",
  phone: "5321234567",
  shopName: "Deneme Emanet",
  address: "Ornek Mah. No 1",
  status: "NEW",
  createdAt: new Date("2026-11-20T10:00:00Z"),
  convertedAt: null,
  convertedShopId: null,
};

beforeEach(() => {
  vi.clearAllMocks();
  auth.requireMobileUser.mockResolvedValue({ user: { id: "admin-1", role: "ADMIN" } });
  auth.requireRole.mockReturnValue(null);
  auth.forbidWhileImpersonating.mockReturnValue(null);
});

describe("mobil admin esnaf on kaydi uclari", () => {
  it("admin olmayan 403 alir, servis cagrilmaz", async () => {
    auth.requireRole.mockReturnValue(NextResponse.json({ error: "forbidden" }, { status: 403 }));
    expect((await convert({ location: "41, 29" })).status).toBe(403);
    expect((await GET(new Request("http://x") as never)).status).toBe(403);
    expect(svc.convertToPartner).not.toHaveBeenCalled();
    expect(svc.list).not.toHaveBeenCalled();
  });

  it("liste on dolguyu sunucudan tasir", async () => {
    svc.list.mockResolvedValue([LEAD]);
    const body = await (await GET(new Request("http://x") as never)).json();
    expect(body[0]).toMatchObject({
      id: LEAD.id,
      whatsapp: "905321234567",
      converted: false,
      draft: { ownerName: "Deneme Esnaf", phone: "05321234567", shopName: "Deneme Emanet", location: "" },
    });
  });

  it("cevirme servise admin ve govdeyle gider, DTO doner", async () => {
    svc.convertToPartner.mockResolvedValue({
      ok: true, alreadyConverted: false, userId: "u1", shopId: "s1", phone: "5321234567",
      resetUrl: "https://example.test/r", activated: true,
    });
    const res = await convert({ location: "41, 29", activate: true, phone: "0532 123 45 67" });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({
      ok: true, alreadyConverted: false, shopId: "s1", userId: "u1",
      resetUrl: "https://example.test/r", activated: true, activationFailed: false,
    });
    expect(svc.convertToPartner).toHaveBeenCalledWith(
      expect.objectContaining({ leadId: LEAD.id, location: "41, 29", activate: true, actor: expect.objectContaining({ userId: "admin-1" }) }),
    );
  });

  it.each([
    ["phone_already_registered", 409],
    ["email_already_registered", 409],
    ["invalid_tr_phone", 400],
    ["not_found", 404],
  ])("%s -> %i, hata kodu cevrilebilir", async (reason, status) => {
    svc.convertToPartner.mockResolvedValue({ ok: false, reason });
    const res = await convert({ location: "41, 29" });
    expect(res.status).toBe(status);
    expect(await res.json()).toEqual({ error: reason });
  });

  it("bilinmeyen alan ve konumsuz govde 400, servise gitmez", async () => {
    expect((await convert({ location: "41, 29", role: "ADMIN" })).status).toBe(400);
    expect((await convert({})).status).toBe(400);
    expect(svc.convertToPartner).not.toHaveBeenCalled();
  });
});
