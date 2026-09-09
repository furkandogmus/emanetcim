import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

/**
 * Bir esnafin, kendi dukkanina ait olmayan bir muhru seri numarasiyla tarayip
 * baska bir dukkanin muhur envanterini (durum, hangi dukkana atandigi)
 * gorememesi gerekir — bkz. src/app/api/mobile/seals/scan/route.ts,
 * 2026-09-10'da bulunan IDOR.
 */

vi.mock("@/lib/mobile-auth", () => ({
  requireMobileUser: vi.fn(),
  requireRole: vi.fn().mockReturnValue(null),
}));

vi.mock("@/lib/db", () => ({
  default: {
    seal: { findUnique: vi.fn() },
    booking: { findUnique: vi.fn() },
  },
}));

vi.mock("@/lib/qr-token", () => ({
  verifyQrToken: vi.fn().mockRejectedValue(new Error("not a booking token")),
}));

import { requireMobileUser } from "@/lib/mobile-auth";
import prisma from "@/lib/db";

function makeRequest(code: string) {
  return new NextRequest("http://localhost/api/mobile/seals/scan", {
    method: "POST",
    body: JSON.stringify({ code }),
  });
}

describe("POST /api/mobile/seals/scan — dukkan kapsami", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("baska bir dukkanin muhrunu PARTNER'a 403 ile reddeder", async () => {
    vi.mocked(requireMobileUser).mockResolvedValue({
      user: { id: "partner-a", role: "PARTNER" },
    } as never);
    vi.mocked(prisma.seal.findUnique).mockResolvedValue({
      serialNumber: 42,
      status: "ASSIGNED",
      shopId: "shop-b",
      assignedAt: new Date(),
      shop: { ownerId: "partner-b" },
    } as never);

    const { POST } = await import("@/app/api/mobile/seals/scan/route");
    const res = await POST(makeRequest("42"));

    expect(res?.status).toBe(403);
  });

  it("kendi dukkaninin muhrunu goruntuleyebilir", async () => {
    vi.mocked(requireMobileUser).mockResolvedValue({
      user: { id: "partner-a", role: "PARTNER" },
    } as never);
    vi.mocked(prisma.seal.findUnique).mockResolvedValue({
      serialNumber: 42,
      status: "ASSIGNED",
      shopId: "shop-a",
      assignedAt: new Date(),
      shop: { ownerId: "partner-a" },
    } as never);

    const { POST } = await import("@/app/api/mobile/seals/scan/route");
    const res = await POST(makeRequest("42"));

    expect(res?.status).toBe(200);
  });

  it("ADMIN her dukkanin muhrunu goruntuleyebilir", async () => {
    vi.mocked(requireMobileUser).mockResolvedValue({
      user: { id: "admin-1", role: "ADMIN" },
    } as never);
    vi.mocked(prisma.seal.findUnique).mockResolvedValue({
      serialNumber: 42,
      status: "ASSIGNED",
      shopId: "shop-b",
      assignedAt: new Date(),
      shop: { ownerId: "partner-b" },
    } as never);

    const { POST } = await import("@/app/api/mobile/seals/scan/route");
    const res = await POST(makeRequest("42"));

    expect(res?.status).toBe(200);
  });

  it("henuz hicbir dukkana atanmamis (stok) muhru PARTNER'a reddeder", async () => {
    vi.mocked(requireMobileUser).mockResolvedValue({
      user: { id: "partner-a", role: "PARTNER" },
    } as never);
    vi.mocked(prisma.seal.findUnique).mockResolvedValue({
      serialNumber: 99,
      status: "STOCK",
      shopId: null,
      assignedAt: null,
      shop: null,
    } as never);

    const { POST } = await import("@/app/api/mobile/seals/scan/route");
    const res = await POST(makeRequest("99"));

    expect(res?.status).toBe(403);
  });
});
