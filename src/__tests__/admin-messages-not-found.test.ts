import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

/**
 * Olmayan mesaj: `update`/`delete` Prisma P2025 firlatip 500 veriyordu
 * (silinmis mesaja ikinci dokunus). Sayi kontrolu 404 `not_found`.
 */
const { mockPrisma, mockRequireMobileUser } = vi.hoisted(() => ({
  mockPrisma: { contactMessage: { updateMany: vi.fn(), deleteMany: vi.fn() } },
  mockRequireMobileUser: vi.fn(),
}));
vi.mock("@/lib/db", () => ({ default: mockPrisma }));
vi.mock("@/lib/mobile-auth", async (orig) => ({
  ...(await orig<typeof import("@/lib/mobile-auth")>()),
  requireMobileUser: mockRequireMobileUser,
}));

import { PATCH, DELETE } from "@/app/api/mobile/admin/messages/[id]/route";

const req = () => new NextRequest("https://bagajpark.com/api/mobile/admin/messages/m1", { method: "PATCH" });
const ctx = { params: Promise.resolve({ id: "m1" }) };

beforeEach(() => {
  vi.clearAllMocks();
  mockRequireMobileUser.mockResolvedValue({ user: { id: "a1", role: "ADMIN" } });
});

describe("mobil admin mesajları", () => {
  it("olmayan mesajı okundu işaretlemek 404", async () => {
    mockPrisma.contactMessage.updateMany.mockResolvedValue({ count: 0 });
    const res = (await PATCH(req(), ctx))!;
    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({ error: "not_found" });
  });

  it("olmayan mesajı silmek 404", async () => {
    mockPrisma.contactMessage.deleteMany.mockResolvedValue({ count: 0 });
    const res = (await DELETE(req(), ctx))!;
    expect(res.status).toBe(404);
  });

  it("var olan mesaj 200", async () => {
    mockPrisma.contactMessage.updateMany.mockResolvedValue({ count: 1 });
    const res = (await PATCH(req(), ctx))!;
    expect(res.status).toBe(200);
  });

  it("misafir 403", async () => {
    mockRequireMobileUser.mockResolvedValue({ user: { id: "g1", role: "GUEST" } });
    const res = (await PATCH(req(), ctx))!;
    expect(res.status).toBe(403);
    expect(mockPrisma.contactMessage.updateMany).not.toHaveBeenCalled();
  });
});
