import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { Prisma } from "@prisma/client";

/** Yorum bildir / yazari gizle / kufur suzgeci (App Review 1.2). */

const m = vi.hoisted(() => {
  const tx = {
    reviewReport: { create: vi.fn(), updateMany: vi.fn() },
    review: { update: vi.fn(), updateMany: vi.fn(), deleteMany: vi.fn(), aggregate: vi.fn() },
    shop: { update: vi.fn() },
  };
  return {
    tx,
    prisma: {
      review: { findUnique: vi.fn(), findMany: vi.fn(), count: vi.fn(), create: vi.fn(), aggregate: vi.fn() },
      reviewBlock: { findMany: vi.fn(), upsert: vi.fn() },
      shop: { update: vi.fn() },
      $transaction: vi.fn(),
    },
    rateLimit: vi.fn(),
    push: vi.fn(),
    audit: vi.fn(),
    requireMobileUser: vi.fn(),
    auth: vi.fn(),
  };
});

vi.mock("@/lib/db", () => ({ default: m.prisma }));
vi.mock("@/lib/rate-limit", () => ({ rateLimit: m.rateLimit }));
vi.mock("@/lib/audit-log", () => ({ writeAuditLog: m.audit }));
vi.mock("@/services/NotificationService", () => ({ notificationService: { pushAdmins: m.push } }));
vi.mock("@/auth", () => ({ auth: m.auth }));
vi.mock("@/lib/revalidate-locales", () => ({ revalidatePathAllLocales: vi.fn() }));
vi.mock("@/lib/mobile-auth", async (orig) => ({
  ...(await orig<typeof import("@/lib/mobile-auth")>()),
  requireMobileUser: m.requireMobileUser,
}));

import { AUTO_HIDE_REASON, reviewService } from "@/services/ReviewService";
import { containsBlockedWords } from "@/lib/review-content-filter";
import * as reportRoute from "@/app/api/mobile/reviews/[id]/report/route";
import * as blockRoute from "@/app/api/mobile/reviews/[id]/block/route";
import { reportReviewAction } from "@/actions/review-report";

const REVIEW = { id: "r1", guestId: "author", shopId: "s1" };

beforeEach(() => {
  vi.clearAllMocks();
  m.rateLimit.mockResolvedValue(true);
  m.prisma.review.findUnique.mockResolvedValue(REVIEW);
  m.prisma.$transaction.mockImplementation(async (fn: (t: typeof m.tx) => unknown) => fn(m.tx));
  m.tx.review.update.mockResolvedValue({ openReportCount: 1 });
  m.tx.review.updateMany.mockResolvedValue({ count: 1 });
  m.tx.review.aggregate.mockResolvedValue({ _avg: { rating: 4 }, _count: { id: 2 } });
  m.prisma.reviewBlock.findMany.mockResolvedValue([]);
  m.tx.reviewReport.create.mockResolvedValue({});
});

describe("containsBlockedWords", () => {
  it.each(["Tam bir orospu cocugu", "SİKTİR git", "s.i.k.t.i.r", "siiiktir", "what a f*cking shit hole", "göt herif"])(
    "hakareti yakalar: %s",
    (text) => expect(containsBlockedWords(text)).toBe(true),
  );
  it.each(["Valizim sıkıştı ama esnaf çok yardımcıydı", "Mal kabul hızlıydı", "Götürüp getirdiler", "Picnic sonrası bıraktım", "Dickens Street yakınında", ""])(
    "masum metni gecirir: %s",
    (text) => expect(containsBlockedWords(text)).toBe(false),
  );
});

describe("ReviewService.addReview kufur suzgeci", () => {
  it("hakaret iceren yorumu yazmadan reddeder", async () => {
    await expect(
      reviewService.addReview({ bookingId: "b", guestId: "g", shopId: "s1", rating: 1, comment: "siktir" }),
    ).rejects.toThrow("REVIEW_INAPPROPRIATE");
    expect(m.prisma.review.create).not.toHaveBeenCalled();
  });
});

describe("ReviewService.report", () => {
  it("bildirimi yazar, sayaci artirir ve yoneticilere push gider", async () => {
    const r = await reviewService.report({ reviewId: "r1", reporterId: "u1", reason: "SPAM", note: "  reklam  " });
    expect(r).toEqual({ ok: true, autoHidden: false });
    expect(m.tx.reviewReport.create).toHaveBeenCalledWith({
      data: { reviewId: "r1", userId: "u1", reason: "SPAM", note: "reklam" },
    });
    expect(m.tx.review.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ openReportCount: { increment: 1 } }) }),
    );
    expect(m.tx.review.updateMany).not.toHaveBeenCalled();
    expect(m.push).toHaveBeenCalledWith("reviewReport", { code: "1" }, { adminScreen: "reviews" });
  });

  it("ucuncu farkli bildirimde yorum otomatik gizlenir ve ortalama yeniden hesaplanir", async () => {
    m.tx.review.update.mockResolvedValue({ openReportCount: 3 });
    const r = await reviewService.report({ reviewId: "r1", reporterId: "u3", reason: "OFFENSIVE" });
    expect(r).toEqual({ ok: true, autoHidden: true });
    expect(m.tx.review.updateMany).toHaveBeenCalledWith({
      where: { id: "r1", hiddenAt: null },
      data: expect.objectContaining({ hiddenReason: AUTO_HIDE_REASON, hiddenById: null }),
    });
    expect(m.tx.shop.update).toHaveBeenCalledWith({ where: { id: "s1" }, data: { rating: 4 } });
  });

  it("ayni kullanici ikinci kez bildiremez", async () => {
    m.tx.reviewReport.create.mockRejectedValueOnce(
      new Prisma.PrismaClientKnownRequestError("dup", { code: "P2002", clientVersion: "7" }),
    );
    await expect(reviewService.report({ reviewId: "r1", reporterId: "u1", reason: "SPAM" })).resolves.toEqual({
      ok: false,
      reason: "duplicate",
    });
    expect(m.push).not.toHaveBeenCalled();
  });

  it("yazar kendi yorumunu bildiremez; hiz siniri asilinca reddedilir", async () => {
    await expect(reviewService.report({ reviewId: "r1", reporterId: "author", reason: "SPAM" })).resolves.toEqual({
      ok: false,
      reason: "own_review",
    });
    m.rateLimit.mockResolvedValue(false);
    await expect(reviewService.report({ reviewId: "r1", reporterId: "u1", reason: "SPAM" })).resolves.toEqual({
      ok: false,
      reason: "rate_limited",
    });
    expect(m.tx.reviewReport.create).not.toHaveBeenCalled();
  });

  it("dukkan sahibi (esnaf) kendi dukkanindaki yorumu bildirebilir", async () => {
    const r = await reviewService.report({ reviewId: "r1", reporterId: "shop-owner", reason: "FALSE_INFO" });
    expect(r.ok).toBe(true);
  });
});

describe("yazari gizle (goruntuleyen basina)", () => {
  it("engel yorum uzerinden yazara yazilir", async () => {
    await expect(reviewService.blockAuthor({ reviewId: "r1", viewerId: "v1" })).resolves.toEqual({ ok: true });
    expect(m.prisma.reviewBlock.upsert).toHaveBeenCalledWith(
      expect.objectContaining({ create: { userId: "v1", blockedUserId: "author" } }),
    );
  });

  it("engellenen yazarin yorumlari o goruntuleyenin listesinden duser", async () => {
    m.prisma.reviewBlock.findMany.mockResolvedValue([{ blockedUserId: "author" }]);
    m.prisma.review.findMany.mockResolvedValue([]);
    m.prisma.review.count.mockResolvedValue(0);
    await reviewService.listShopReviews("s1", { viewerId: "v1" });
    expect(m.prisma.review.findMany.mock.calls[0][0].where).toMatchObject({
      shopId: "s1",
      hiddenAt: null,
      guestId: { notIn: ["author"] },
    });
  });

  it("oturumsuz goruntuleyende engel sorgusu calismaz", async () => {
    m.prisma.review.findMany.mockResolvedValue([]);
    m.prisma.review.count.mockResolvedValue(0);
    await reviewService.listShopReviews("s1", {});
    expect(m.prisma.reviewBlock.findMany).not.toHaveBeenCalled();
    expect(m.prisma.review.findMany.mock.calls[0][0].where.guestId).toBeUndefined();
  });
});

describe("tasiyicilar", () => {
  const post = (url: string, body?: unknown) =>
    new NextRequest(url, { method: "POST", body: body === undefined ? undefined : JSON.stringify(body) });

  it("mobil bildir: gecersiz neden 400, tekrar 409, basari 200", async () => {
    m.requireMobileUser.mockResolvedValue({ user: { id: "u1", role: "GUEST" } });
    const ctx = { params: Promise.resolve({ id: "r1" }) };
    expect((await reportRoute.POST(post("https://x/api/mobile/reviews/r1/report", { reason: "NOPE" }), ctx))!.status).toBe(400);

    const ok = await reportRoute.POST(post("https://x/api/mobile/reviews/r1/report", { reason: "SPAM" }), {
      params: Promise.resolve({ id: "r1" }),
    });
    expect(ok!.status).toBe(200);

    m.tx.reviewReport.create.mockRejectedValueOnce(
      new Prisma.PrismaClientKnownRequestError("dup", { code: "P2002", clientVersion: "7" }),
    );
    const dup = await reportRoute.POST(post("https://x/api/mobile/reviews/r1/report", { reason: "SPAM" }), {
      params: Promise.resolve({ id: "r1" }),
    });
    expect(dup!.status).toBe(409);
    expect(await dup!.json()).toEqual({ error: "duplicate" });
  });

  it("mobil gizle: kendi yorumunda 409", async () => {
    m.requireMobileUser.mockResolvedValue({ user: { id: "author", role: "GUEST" } });
    const res = await blockRoute.POST(post("https://x/api/mobile/reviews/r1/block"), { params: Promise.resolve({ id: "r1" }) });
    expect(res!.status).toBe(409);
  });

  it("web action ayni servisi cagirir ve alan kodunu ceviri anahtarina cevirir", async () => {
    m.auth.mockResolvedValue({ user: { id: "author", role: "GUEST" } });
    await expect(reportReviewAction({ reviewId: "r1", reason: "SPAM" })).resolves.toEqual({
      success: false,
      error: "Errors.reviewReportOwn",
    });
    m.auth.mockResolvedValue({ user: { id: "p1", role: "PARTNER" } });
    await expect(reportReviewAction({ reviewId: "r1", reason: "OFFENSIVE" })).resolves.toEqual({ success: true });
    await expect(reportReviewAction({ reviewId: "r1", reason: "<script>" })).resolves.toEqual({
      success: false,
      error: "Errors.invalidData",
    });
  });
});
