import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

/**
 * Imzasi dolmus ama veritabaninda KAYITLI QR token'i da taranir: eski surumde
 * 48 saatle sinirli uretilmis bilet teslim gununde "BagajPark QR'i degil"
 * cikiyordu.
 */
vi.mock("@/lib/mobile-auth", () => ({
  requireMobileUser: vi.fn(),
  requireRole: vi.fn().mockReturnValue(null),
}));
vi.mock("@/lib/db", () => ({
  default: { seal: { findUnique: vi.fn() }, booking: { findUnique: vi.fn() } },
}));
vi.mock("@/lib/qr-token", () => ({ verifyQrToken: vi.fn().mockResolvedValue(null) }));
vi.mock("@/services/booking/access", () => ({
  canOperateBookingAtShop: vi.fn().mockReturnValue(true),
  canOperateSealAtShop: vi.fn().mockReturnValue(true),
}));

import { requireMobileUser } from "@/lib/mobile-auth";
import prisma from "@/lib/db";
import { POST } from "@/app/api/mobile/seals/scan/route";

const scan = (code: string) =>
  POST(
    new NextRequest("http://localhost/api/mobile/seals/scan", {
      method: "POST",
      body: JSON.stringify({ code }),
    }),
  );

describe("seals/scan kayitli token", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(requireMobileUser).mockResolvedValue({ user: { id: "p", role: "PARTNER" } } as never);
  });

  it("imzasi gecersiz ama kayitli token rezervasyonu doner", async () => {
    vi.mocked(prisma.booking.findUnique).mockResolvedValue({
      id: "b1",
      status: "APPROVED",
      shop: { name: "Dukkan" },
      guest: { name: "Misafir" },
      checkInTime: new Date(),
      checkOutTime: new Date(),
    } as never);
    const res = await scan("eski.bir.token");
    expect(res!.status).toBe(200);
    expect(prisma.booking.findUnique).toHaveBeenCalledWith(
      expect.objectContaining({ where: { qrCodeToken: "eski.bir.token" } }),
    );
  });

  it("kayitli degilse unknown_code", async () => {
    vi.mocked(prisma.booking.findUnique).mockResolvedValue(null);
    const res = await scan("tamamen-yabanci");
    expect(res!.status).toBe(404);
    expect((await res!.json()).error).toBe("unknown_code");
  });

  it("temp_ yer tutucusu aranmaz", async () => {
    const res = await scan("temp_123");
    expect(res!.status).toBe(404);
    expect(prisma.booking.findUnique).not.toHaveBeenCalled();
  });
});
