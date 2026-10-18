import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

/**
 * Mobil admin cevabı web paneliyle AYNI servisten geçer: gönderilemeyen cevap
 * kaydedilmez, misafir/esnaf giremez, olmayan mesaj 404.
 */
const { mockPrisma, mockRequireMobileUser, mockSend } = vi.hoisted(() => ({
  mockPrisma: {
    contactMessage: { findUnique: vi.fn(), update: vi.fn().mockResolvedValue({}) },
    contactReply: { create: vi.fn() },
  },
  mockRequireMobileUser: vi.fn(),
  mockSend: vi.fn(),
}));
vi.mock("@/lib/db", () => ({ default: mockPrisma }));
vi.mock("@/lib/mail", () => ({ sendSupportReplyEmail: mockSend }));
vi.mock("@/lib/rate-limit", () => ({ rateLimit: vi.fn().mockResolvedValue(true) }));
vi.mock("@/lib/mobile-auth", async (orig) => ({
  ...(await orig<typeof import("@/lib/mobile-auth")>()),
  requireMobileUser: mockRequireMobileUser,
}));

import { POST } from "@/app/api/mobile/admin/messages/[id]/reply/route";

const ID = "cmsg_0123456789";
const req = (body: unknown) =>
  new NextRequest(`https://bagajpark.com/api/mobile/admin/messages/${ID}/reply`, {
    method: "POST",
    body: JSON.stringify(body),
  });
const ctx = { params: Promise.resolve({ id: ID }) };

beforeEach(() => {
  vi.clearAllMocks();
  mockRequireMobileUser.mockResolvedValue({ user: { id: "a1", role: "ADMIN" } });
  mockPrisma.contactMessage.findUnique.mockResolvedValue({
    id: ID,
    from: "Gezgin <gezgin@example.com>",
    to: "destek@bagajpark.com",
    subject: "Valizim nerede",
    inboundMessageId: null,
  });
  mockPrisma.contactReply.create.mockImplementation(async ({ data }: { data: Record<string, unknown> }) => ({
    id: "r1",
    ...data,
    createdAt: new Date("2026-10-18T12:00:00Z"),
  }));
  mockSend.mockResolvedValue({ id: "resend-1" });
});

describe("POST /api/mobile/admin/messages/[id]/reply", () => {
  it("cevap gider, kaydedilir ve mesaj okundu olur", async () => {
    const res = (await POST(req({ body: "Valiziniz dükkanda." }), ctx))!;
    expect(res.status).toBe(200);
    expect(mockSend.mock.calls[0][0]).toMatchObject({
      to: "gezgin@example.com",
      from: "BagajPark Destek <destek@bagajpark.com>",
      text: "Valiziniz dükkanda.",
    });
    expect(mockPrisma.contactReply.create.mock.calls[0][0].data.sentBy).toBe("a1");
    expect(mockPrisma.contactMessage.update).toHaveBeenCalled();
  });

  it("e-posta gitmezse 502 ve kayıt yok", async () => {
    mockSend.mockResolvedValue(null);
    const res = (await POST(req({ body: "merhaba" }), ctx))!;
    expect(res.status).toBe(502);
    expect(await res.json()).toEqual({ error: "email_send_failed" });
    expect(mockPrisma.contactReply.create).not.toHaveBeenCalled();
  });

  it("boş gövde 400", async () => {
    const res = (await POST(req({ body: "  " }), ctx))!;
    expect(res.status).toBe(400);
    expect(mockSend).not.toHaveBeenCalled();
  });

  it("olmayan mesaj 404", async () => {
    mockPrisma.contactMessage.findUnique.mockResolvedValue(null);
    const res = (await POST(req({ body: "merhaba" }), ctx))!;
    expect(res.status).toBe(404);
  });

  it("esnaf 403", async () => {
    mockRequireMobileUser.mockResolvedValue({ user: { id: "p1", role: "PARTNER" } });
    const res = (await POST(req({ body: "merhaba" }), ctx))!;
    expect(res.status).toBe(403);
    expect(mockSend).not.toHaveBeenCalled();
  });
});
