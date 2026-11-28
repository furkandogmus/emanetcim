import { describe, it, expect, vi, beforeEach } from "vitest";
import fs from "node:fs";
import path from "node:path";

/**
 * Hesapsiz rezervasyonlari hesaba baglama (kural 1c, 2026-11-22): yalnizca
 * DOGRULANMIS e-posta, telefonla asla, idempotent.
 */
const { mockPrisma } = vi.hoisted(() => ({
  mockPrisma: {
    user: { findUnique: vi.fn(), updateMany: vi.fn() },
    booking: { findMany: vi.fn(), updateMany: vi.fn() },
  },
}));
vi.mock("@/lib/db", () => ({ default: mockPrisma }));

import { linkGuestBookingsToVerifiedUser } from "@/services/booking/guest-link";
import { markEmailVerifiedByCode } from "@/services/auth/verify-email";

const read = (p: string) => fs.readFileSync(path.join(process.cwd(), p), "utf8");

beforeEach(() => {
  vi.clearAllMocks();
  mockPrisma.booking.updateMany.mockResolvedValue({ count: 0 });
});

describe("linkGuestBookingsToVerifiedUser", () => {
  it("dogrulanmamis e-postada HICBIR sey baglamaz", async () => {
    mockPrisma.user.findUnique.mockResolvedValue({ email: "ada@example.com", emailVerified: null });
    expect(await linkGuestBookingsToVerifiedUser("u1")).toBe(0);
    expect(mockPrisma.booking.findMany).not.toHaveBeenCalled();
    expect(mockPrisma.booking.updateMany).not.toHaveBeenCalled();
  });

  it("e-postasiz (yalniz telefonlu) hesapta baglamaz", async () => {
    mockPrisma.user.findUnique.mockResolvedValue({ email: null, emailVerified: new Date() });
    expect(await linkGuestBookingsToVerifiedUser("u1")).toBe(0);
    expect(mockPrisma.booking.findMany).not.toHaveBeenCalled();
  });

  it("dogrulanmis e-postada yalnizca guestId NULL + ayni e-posta (harf duyarsiz) baglanir", async () => {
    mockPrisma.user.findUnique.mockResolvedValue({ email: "Ada@Example.com", emailVerified: new Date() });
    mockPrisma.booking.findMany.mockResolvedValue([
      { id: "b1", guestEmail: "ADA@example.com" },
      // ILIKE joker yakalamasi (`_`): tam esitlikte elenmeli.
      { id: "b2", guestEmail: "ad_@example.com" },
    ]);
    mockPrisma.booking.updateMany.mockResolvedValue({ count: 1 });

    expect(await linkGuestBookingsToVerifiedUser("u1")).toBe(1);
    const where = mockPrisma.booking.findMany.mock.calls[0][0].where;
    expect(where).toEqual({
      guestId: null,
      guestEmail: { equals: "ada@example.com", mode: "insensitive" },
      // Kapidan gelen misafirin e-postasini operator yazdi: otomatik baglanmaz, NULL kanal baglanir.
      OR: [{ source: null }, { source: { not: "walk_in" } }],
    });
    // Telefonla baglama YOK.
    expect(JSON.stringify(where)).not.toContain("guestPhone");
    expect(mockPrisma.booking.updateMany).toHaveBeenCalledWith({
      where: { id: { in: ["b1"] }, guestId: null },
      data: { guestId: "u1" },
    });
  });

  it("idempotent: ikinci cagri baglanmis satirlari tekrar bulmaz", async () => {
    mockPrisma.user.findUnique.mockResolvedValue({ email: "ada@example.com", emailVerified: new Date() });
    mockPrisma.booking.findMany.mockResolvedValueOnce([{ id: "b1", guestEmail: "ada@example.com" }]);
    mockPrisma.booking.updateMany.mockResolvedValueOnce({ count: 1 });
    expect(await linkGuestBookingsToVerifiedUser("u1")).toBe(1);

    mockPrisma.booking.findMany.mockResolvedValueOnce([]);
    expect(await linkGuestBookingsToVerifiedUser("u1")).toBe(0);
    expect(mockPrisma.booking.updateMany).toHaveBeenCalledTimes(1);
  });

  it("veritabani hatasi girisi dusurmez", async () => {
    mockPrisma.user.findUnique.mockRejectedValue(new Error("db down"));
    await expect(linkGuestBookingsToVerifiedUser("u1")).resolves.toBe(0);
  });

  it("kodla giris dogrulamasi baglamayi tetikler", async () => {
    mockPrisma.user.updateMany.mockResolvedValue({ count: 0 });
    mockPrisma.user.findUnique.mockResolvedValue({ email: "ada@example.com", emailVerified: new Date() });
    mockPrisma.booking.findMany.mockResolvedValue([]);
    await markEmailVerifiedByCode("u1");
    expect(mockPrisma.booking.findMany).toHaveBeenCalled();
  });
});

describe("baglama noktalari", () => {
  it("her dogrulama noktasi ayni servisi cagirir", () => {
    const verify = read("src/services/auth/verify-email.ts");
    // verifyEmailToken + markEmailVerifiedByCode
    expect(verify.match(/linkGuestBookingsToVerifiedUser\(/g)?.length).toBe(2);
    // Sifirlama yollari (bag + kod) davranissal olarak `password-reset-code.test.ts`te.
    // Mobil kodla giris: zaten dogrulanmis hesapta da cagrilir.
    expect(read("src/app/api/mobile/auth/session/route.ts")).toMatch(/if \(isEmail\) \{\s+const proof = await markEmailVerifiedByLogin\(user\.id\)/);
  });

  it("sifreli kayit (dogrulanmamis) baglamaz", () => {
    // Kayit action'lari dogrulama noktasi DEGIL: baglama servisine hic ulasmamali.
    const register = read("src/actions/register.ts");
    expect(register).not.toMatch(/linkGuestBookings|markEmailVerifiedByCode/);
    // Mobil sifreli giris dali da cagirmaz.
    const session = read("src/app/api/mobile/auth/session/route.ts");
    const passwordBranch = session.slice(session.indexOf("} else if (password) {"));
    expect(passwordBranch).not.toMatch(/markEmailVerifiedByCode|linkGuestBookings/);
  });
});
