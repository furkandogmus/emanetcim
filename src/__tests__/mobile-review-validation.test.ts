import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

/** Bozuk / metin puanli / asiri uzun govde 500 degil 400 `invalid_data` doner. */
const { mockRequireMobileUser, mockPrisma, mockReview } = vi.hoisted(() => ({
  mockRequireMobileUser: vi.fn(),
  mockPrisma: { booking: { findUnique: vi.fn() } },
  mockReview: { addReview: vi.fn() },
}));
vi.mock("@/lib/mobile-auth", async (orig) => ({
  ...(await orig<typeof import("@/lib/mobile-auth")>()),
  requireMobileUser: mockRequireMobileUser,
}));
vi.mock("@/lib/db", () => ({ default: mockPrisma }));
vi.mock("@/services/ReviewService", () => ({ reviewService: mockReview }));

import { POST } from "@/app/api/mobile/reviews/route";

const req = (body: string) =>
  new NextRequest("https://bagajpark.com/api/mobile/reviews", { method: "POST", body, headers: { "content-type": "application/json" } });

beforeEach(() => {
  vi.clearAllMocks();
  mockRequireMobileUser.mockResolvedValue({ user: { id: "g1", role: "GUEST" } });
  mockPrisma.booking.findUnique.mockResolvedValue({ id: "b1", guestId: "g1", shopId: "s1", status: "CHECKED_OUT" });
  mockReview.addReview.mockResolvedValue({ id: "r1", rating: 5 });
});

describe("mobil yorum doğrulaması", () => {
  it.each([
    ["bozuk JSON", "{"],
    ["metin puan", JSON.stringify({ bookingId: "b1", rating: "5" })],
    ["aralık dışı puan", JSON.stringify({ bookingId: "b1", rating: 6 })],
    ["ondalık puan", JSON.stringify({ bookingId: "b1", rating: 4.5 })],
    ["2000+ yorum", JSON.stringify({ bookingId: "b1", rating: 5, comment: "x".repeat(2001) })],
  ])("%s → 400 invalid_data", async (_n, body) => {
    const res = (await POST(req(body)))!;
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: "invalid_data" });
    expect(mockReview.addReview).not.toHaveBeenCalled();
  });

  it("geçerli yorum kaydedilir", async () => {
    const res = (await POST(req(JSON.stringify({ bookingId: "b1", rating: 5, comment: " güzel " }))))!;
    expect(res.status).toBe(200);
    expect(mockReview.addReview).toHaveBeenCalledWith(expect.objectContaining({ rating: 5, comment: "güzel" }));
  });
});
