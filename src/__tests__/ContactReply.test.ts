/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * Panelden destek cevabı (P: mailto-yerine-gerçek-eposta, 2026-08-23).
 *
 * Sözleşme: cevap YALNIZCA e-posta gerçekten gönderilirse kaydedilir —
 * gitmemiş bir cevabı panelde "gitti" diye göstermek en kötü durumdur.
 */
const { mockPrisma, mockAuth, mockSend } = vi.hoisted(() => ({
  mockPrisma: {
    contactMessage: { findUnique: vi.fn(), update: vi.fn().mockResolvedValue({}) },
    contactReply: { create: vi.fn() },
  },
  mockAuth: vi.fn(),
  mockSend: vi.fn(),
}));

vi.mock("@/lib/db", () => ({ default: mockPrisma }));
vi.mock("@/auth", () => ({ auth: mockAuth }));
vi.mock("@/lib/mail", () => ({ sendSupportReplyEmail: mockSend }));
vi.mock("@/lib/rate-limit", () => ({ rateLimit: vi.fn().mockResolvedValue(true) }));
vi.mock("@/lib/revalidate-locales", () => ({ revalidatePathAllLocales: vi.fn() }));
vi.mock("next/headers", () => ({ headers: vi.fn() }));

import { replyToContactMessageAction } from "@/actions/contact";

const MESSAGE = {
  id: "cmsg_0123456789",
  from: "Gezgin <gezgin@example.com>",
  to: "destek@bagajpark.com",
  subject: "Re: : Re Valizim nerede",
  inboundMessageId: "<abc-123@mail.example.com>",
};

describe("replyToContactMessageAction", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAuth.mockResolvedValue({ user: { id: "admin-1", role: "ADMIN" } });
    mockPrisma.contactMessage.findUnique.mockResolvedValue(MESSAGE);
    mockPrisma.contactReply.create.mockImplementation(async ({ data }: any) => ({
      id: "r1",
      ...data,
      createdAt: new Date("2026-08-23T12:00:00Z"),
    }));
    mockSend.mockResolvedValue({ id: "resend-1" });
  });

  it("ADMIN olmayan reddedilir", async () => {
    mockAuth.mockResolvedValue({ user: { id: "u1", role: "PARTNER" } });
    const res = await replyToContactMessageAction({ messageId: MESSAGE.id, body: "merhaba" });
    expect(res.success).toBe(false);
    expect(mockSend).not.toHaveBeenCalled();
  });

  it("cevap misafirin yazdığı adresten, zincir başlığıyla gider", async () => {
    const res = await replyToContactMessageAction({
      messageId: MESSAGE.id,
      body: "Valiziniz dükkanda, mühür 101 ile.",
    });

    expect(res.success).toBe(true);
    expect(mockSend).toHaveBeenCalledWith({
      to: "gezgin@example.com",
      from: "BagajPark Destek <destek@bagajpark.com>",
      // Outlook'un "Re: : Re" zinciri sadeleşir, tek Re: kalır.
      subject: "Re: Valizim nerede",
      text: "Valiziniz dükkanda, mühür 101 ile.",
      inReplyTo: "<abc-123@mail.example.com>",
    });
    expect(mockPrisma.contactReply.create).toHaveBeenCalled();
    expect(mockPrisma.contactMessage.update).toHaveBeenCalledWith({
      where: { id: MESSAGE.id },
      data: { isRead: true },
    });
  });

  it("misafir BAŞKA domain'e yazdıysa gönderen RESEND_FROM'a düşer", async () => {
    mockPrisma.contactMessage.findUnique.mockResolvedValue({
      ...MESSAGE,
      to: "info@baskadomain.com",
    });
    await replyToContactMessageAction({ messageId: MESSAGE.id, body: "merhaba" });
    expect(mockSend.mock.calls[0][0].from).not.toContain("baskadomain.com");
  });

  it("e-posta GÖNDERİLEMEZSE kayıt yazılmaz", async () => {
    mockSend.mockResolvedValue(null);
    const res = await replyToContactMessageAction({ messageId: MESSAGE.id, body: "merhaba" });
    expect(res.success).toBe(false);
    expect(mockPrisma.contactReply.create).not.toHaveBeenCalled();
    expect(mockPrisma.contactMessage.update).not.toHaveBeenCalled();
  });

  it("geçersiz gövde reddedilir", async () => {
    const res = await replyToContactMessageAction({ messageId: MESSAGE.id, body: "x" });
    expect(res.success).toBe(false);
    expect(mockSend).not.toHaveBeenCalled();
  });
});
