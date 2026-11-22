import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * Yorum moderasyonu (2026-11-23): yonetici yorumu gizler, geri alir ya da siler.
 *
 * Asil risk sayidir: `Shop.rating` arama siralamasini besliyor ve misafire en
 * gorunur isaret. Gizlenen tek yildizli yorum ortalamada kalirsa moderasyonun
 * hicbir etkisi olmaz; gizleme geri alinip ortalama eski yerine donmezse puan
 * kalici olarak yanlis kalir. Sahte veritabani `aggregate`in `where`ini GERCEKTEN
 * uygular, yani filtre kaldirilirsa bu testler sayidan duser.
 */
type Row = { id: string; shopId: string; guestId: string; rating: number; comment: string | null; hiddenAt: Date | null };

const state = vi.hoisted(() => ({ reviews: [] as Row[], shopRating: new Map<string, number>() }));

function matches(r: Row, where: Record<string, unknown> = {}) {
  if ("shopId" in where && r.shopId !== where.shopId) return false;
  if ("hiddenAt" in where) {
    const h = where.hiddenAt;
    if (h === null && r.hiddenAt !== null) return false;
    if (h && typeof h === "object" && "not" in h && r.hiddenAt === null) return false;
  }
  return true;
}

const db = vi.hoisted(() => ({
  review: {
    findUnique: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    aggregate: vi.fn(),
  },
  shop: { update: vi.fn() },
}));
const audit = vi.hoisted(() => vi.fn());

vi.mock("@/lib/db", () => ({ default: db }));
vi.mock("@/lib/audit-log", () => ({ writeAuditLog: audit }));

import { reviewService } from "@/services/ReviewService";

const ADMIN = { id: "admin-1", ip: "198.51.100.4" };

beforeEach(() => {
  vi.clearAllMocks();
  state.reviews = [
    { id: "r5", shopId: "s1", guestId: "g1", rating: 5, comment: "Harika", hiddenAt: null },
    { id: "r1", shopId: "s1", guestId: "g2", rating: 1, comment: "Hakaret iceren metin", hiddenAt: null },
    { id: "rx", shopId: "s2", guestId: "g3", rating: 2, comment: null, hiddenAt: null },
  ];
  state.shopRating = new Map([["s1", 3]]);
  db.review.findUnique.mockImplementation(async ({ where }: { where: { id: string } }) =>
    state.reviews.find((r) => r.id === where.id) ?? null,
  );
  db.review.update.mockImplementation(async ({ where, data }: { where: { id: string }; data: Partial<Row> }) => {
    const r = state.reviews.find((x) => x.id === where.id)!;
    Object.assign(r, data);
    return r;
  });
  db.review.delete.mockImplementation(async ({ where }: { where: { id: string } }) => {
    state.reviews = state.reviews.filter((r) => r.id !== where.id);
  });
  db.review.aggregate.mockImplementation(async ({ where }: { where: Record<string, unknown> }) => {
    const rows = state.reviews.filter((r) => matches(r, where));
    const avg = rows.length ? rows.reduce((n, r) => n + r.rating, 0) / rows.length : null;
    return { _avg: { rating: avg }, _count: { id: rows.length } };
  });
  db.shop.update.mockImplementation(async ({ where, data }: { where: { id: string }; data: { rating: number } }) => {
    state.shopRating.set(where.id, data.rating);
  });
});

describe("ReviewService.moderate", () => {
  it("gizlenen yorum dukkan ortalamasindan cikar, geri alinca geri girer", async () => {
    expect(await reviewService.moderate({ reviewId: "r1", action: "hide", reason: "Hakaret", actor: ADMIN })).toEqual({
      ok: true,
      shopId: "s1",
      rating: 1,
    });
    expect(state.shopRating.get("s1")).toBe(5);
    expect(state.reviews.find((r) => r.id === "r1")).toMatchObject({ hiddenReason: "Hakaret", hiddenById: "admin-1" });

    await reviewService.moderate({ reviewId: "r1", action: "unhide", actor: ADMIN });
    expect(state.shopRating.get("s1")).toBe(3);
    expect(state.reviews.find((r) => r.id === "r1")).toMatchObject({ hiddenAt: null, hiddenReason: null });
  });

  it("silinen yorum ortalamadan cikar; son gorunur yorum da gidince puan sifira doner", async () => {
    await reviewService.moderate({ reviewId: "r1", action: "delete", reason: "Spam", actor: ADMIN });
    expect(state.reviews.map((r) => r.id)).not.toContain("r1");
    expect(state.shopRating.get("s1")).toBe(5);

    await reviewService.moderate({ reviewId: "r5", action: "hide", reason: "Sahte", actor: ADMIN });
    expect(state.shopRating.get("s1")).toBe(0);
  });

  it("baska dukkanin yorumu bu dukkanin ortalamasina karismaz", async () => {
    await reviewService.moderate({ reviewId: "rx", action: "hide", reason: "Konu disi", actor: ADMIN });
    expect(state.shopRating.has("s2")).toBe(true);
    expect(state.shopRating.get("s1")).toBe(3);
  });

  it("her islem denetim kaydi birakir; silinen metnin izi kayitta kalir", async () => {
    await reviewService.moderate({ reviewId: "r1", action: "hide", reason: "Hakaret", actor: ADMIN });
    expect(audit).toHaveBeenLastCalledWith(
      expect.objectContaining({
        actorUserId: "admin-1",
        actorRole: "ADMIN",
        action: "admin.review.hide",
        entityType: "Review",
        entityId: "r1",
        ip: "198.51.100.4",
        metadata: expect.objectContaining({ shopId: "s1", rating: 1, reason: "Hakaret" }),
      }),
    );
    await reviewService.moderate({ reviewId: "r1", action: "unhide", actor: ADMIN });
    expect(audit).toHaveBeenLastCalledWith(expect.objectContaining({ action: "admin.review.unhide" }));
    await reviewService.moderate({ reviewId: "r1", action: "delete", reason: "Spam", actor: ADMIN });
    expect(audit).toHaveBeenLastCalledWith(
      expect.objectContaining({
        action: "admin.review.delete",
        metadata: expect.objectContaining({ comment: "Hakaret iceren metin", reason: "Spam" }),
      }),
    );
    expect(audit).toHaveBeenCalledTimes(3);
  });

  it("gerekcesiz gizleme, olmayan yorum ve yanlis durum yazmadan reddedilir", async () => {
    expect(await reviewService.moderate({ reviewId: "r1", action: "hide", reason: "  ", actor: ADMIN })).toEqual({
      ok: false,
      reason: "reason_required",
    });
    expect(await reviewService.moderate({ reviewId: "yok", action: "delete", actor: ADMIN })).toEqual({
      ok: false,
      reason: "not_found",
    });
    expect(await reviewService.moderate({ reviewId: "r5", action: "unhide", actor: ADMIN })).toEqual({
      ok: false,
      reason: "not_hidden",
    });
    state.reviews[0].hiddenAt = new Date();
    expect(await reviewService.moderate({ reviewId: "r5", action: "hide", reason: "Tekrar", actor: ADMIN })).toEqual({
      ok: false,
      reason: "already_hidden",
    });
    expect(db.review.update).not.toHaveBeenCalled();
    expect(db.review.delete).not.toHaveBeenCalled();
    expect(db.shop.update).not.toHaveBeenCalled();
    expect(audit).not.toHaveBeenCalled();
  });
});
