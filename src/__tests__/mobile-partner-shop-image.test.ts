import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

/** Esnafin vitrin fotografi: dukkan oturumdan gelir, govde `setShopImage`te. */
const { mockRequireMobileUser, mockShopService, mockConfigured } = vi.hoisted(() => ({
  mockRequireMobileUser: vi.fn(),
  mockShopService: { getShopByOwner: vi.fn(), setShopImage: vi.fn() },
  mockConfigured: vi.fn(),
}));
vi.mock("@/lib/mobile-auth", async (orig) => ({
  ...(await orig<typeof import("@/lib/mobile-auth")>()),
  requireMobileUser: mockRequireMobileUser,
}));
vi.mock("@/services/ShopService", () => ({ shopService: mockShopService }));
vi.mock("@/lib/storage", () => ({ isStorageConfigured: mockConfigured }));

import { POST } from "@/app/api/mobile/partner/shop/image/route";

function req(withFile = true) {
  const form = new FormData();
  if (withFile) form.append("file", new Blob([new Uint8Array([0xff, 0xd8, 0xff])], { type: "image/jpeg" }), "a.jpg");
  return new NextRequest("https://bagajpark.com/api/mobile/partner/shop/image", { method: "POST", body: form });
}

beforeEach(() => {
  vi.clearAllMocks();
  mockConfigured.mockReturnValue(true);
  mockRequireMobileUser.mockResolvedValue({ user: { id: "p1", role: "PARTNER" } });
  mockShopService.getShopByOwner.mockResolvedValue({ id: "s1" });
  mockShopService.setShopImage.mockResolvedValue({ ok: true, url: "https://cdn/x.jpg" });
});

describe("mobil dükkan fotoğrafı", () => {
  it("esnafın kendi dükkanına yükler ve adresi döner", async () => {
    const res = (await POST(req()))!;
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ url: "https://cdn/x.jpg" });
    expect(mockShopService.setShopImage).toHaveBeenCalledWith(
      expect.objectContaining({ shopId: "s1", actorId: "p1", actorRole: "PARTNER" }),
    );
  });

  it("depolama ayarlı değilse 503", async () => {
    mockConfigured.mockReturnValue(false);
    const res = (await POST(req()))!;
    expect(res.status).toBe(503);
    expect(mockShopService.setShopImage).not.toHaveBeenCalled();
  });

  it("misafir 403", async () => {
    mockRequireMobileUser.mockResolvedValue({ user: { id: "g1", role: "GUEST" } });
    const res = (await POST(req()))!;
    expect(res.status).toBe(403);
  });

  it("dosya yoksa 400 empty", async () => {
    const res = (await POST(req(false)))!;
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: "empty" });
  });

  it("servis hatası durum koduna çevrilir", async () => {
    mockShopService.setShopImage.mockResolvedValue({ ok: false, reason: "unsupported_type" });
    const res = (await POST(req()))!;
    expect(res.status).toBe(415);
    expect(await res.json()).toEqual({ error: "unsupported_type" });
  });
});
