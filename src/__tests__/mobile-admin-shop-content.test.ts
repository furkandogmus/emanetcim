import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * Yonetici esnaf adina fotograf, saat ve yorum duzenler (2026-11-23).
 * Kapi kurallari: yalniz ADMIN, goruntuleme oturumunda yazma yok, dukkan URL'den
 * gelir. Esnaf ucu ise dukkani oturumdaki sahipten cozmeye devam eder.
 */
const svc = vi.hoisted(() => ({
  galleryAdd: vi.fn(),
  galleryRemove: vi.fn(),
  makeCover: vi.fn(),
  galleryList: vi.fn(),
  setShopImage: vi.fn(),
  getShopByOwner: vi.fn(),
  saveWeeklyHours: vi.fn(),
  addClosure: vi.fn(),
  removeClosure: vi.fn(),
  getScheduleView: vi.fn(),
  moderate: vi.fn(),
  listForAdmin: vi.fn(),
}));
const session = vi.hoisted(() => ({ user: { id: "admin-1", role: "ADMIN", impersonatedBy: undefined as string | undefined } }));
const db = vi.hoisted(() => ({ shop: { findUnique: vi.fn() } }));

vi.mock("@/lib/db", () => ({ default: db }));
vi.mock("@/lib/mobile-auth", async (orig) => {
  const actual = await orig<typeof import("@/lib/mobile-auth")>();
  return { ...actual, requireMobileUser: vi.fn(async () => ({ user: session.user })) };
});
vi.mock("@/lib/storage", () => ({ isStorageConfigured: () => true }));
vi.mock("@/lib/revalidate-locales", () => ({ revalidatePathAllLocales: vi.fn() }));
vi.mock("@/services/ShopGalleryService", () => ({
  shopGalleryService: { add: svc.galleryAdd, remove: svc.galleryRemove, makeCover: svc.makeCover, list: svc.galleryList },
}));
vi.mock("@/services/ShopService", () => ({
  shopService: { setShopImage: svc.setShopImage, getShopByOwner: svc.getShopByOwner },
}));
vi.mock("@/services/ShopScheduleService", () => ({
  saveWeeklyHours: svc.saveWeeklyHours,
  addClosure: svc.addClosure,
  removeClosure: svc.removeClosure,
  getScheduleView: svc.getScheduleView,
}));
vi.mock("@/services/ReviewService", async (orig) => {
  const actual = await orig<typeof import("@/services/ReviewService")>();
  return { ...actual, reviewService: { moderate: svc.moderate, listForAdmin: svc.listForAdmin } };
});

import * as adminImages from "@/app/api/mobile/admin/shops/[id]/images/route";
import * as adminImage from "@/app/api/mobile/admin/shops/[id]/image/route";
import * as adminImageOne from "@/app/api/mobile/admin/shops/[id]/images/[imageId]/route";
import * as adminSchedule from "@/app/api/mobile/admin/shops/[id]/schedule/route";
import * as partnerSchedule from "@/app/api/mobile/partner/shop/schedule/route";
import * as moderation from "@/app/api/mobile/admin/reviews/[id]/[action]/route";
import * as recentReviews from "@/app/api/mobile/admin/reviews/route";

const req = (url: string, init: RequestInit = {}) => {
  const r = new Request(`http://x/api/mobile${url}`, init) as Request & { nextUrl: URL };
  r.nextUrl = new URL(r.url);
  return r as never;
};
const photo = () => {
  const form = new FormData();
  form.append("file", new Blob([new Uint8Array([1, 2, 3])], { type: "image/jpeg" }), "a.jpg");
  return { method: "POST", body: form };
};
const json = (method: string, body: unknown) => ({
  method,
  headers: { "content-type": "application/json" },
  body: JSON.stringify(body),
});
const week = {
  open247: false,
  days: [1, 2, 3, 4, 5, 6, 7].map((weekday) => ({ weekday, isClosed: false, openingTime: "08:00", closingTime: "22:00" })),
};
const ctx = (p: Record<string, string>) => ({ params: Promise.resolve(p) }) as never;

beforeEach(() => {
  vi.clearAllMocks();
  session.user = { id: "admin-1", role: "ADMIN", impersonatedBy: undefined };
  db.shop.findUnique.mockResolvedValue({ id: "s-other", image: null });
  svc.galleryAdd.mockResolvedValue({ ok: true, id: "i1", url: "https://cdn/x.jpg" });
  svc.galleryRemove.mockResolvedValue({ ok: true });
  svc.setShopImage.mockResolvedValue({ ok: true, url: "https://cdn/c.jpg" });
  svc.saveWeeklyHours.mockResolvedValue({ ok: true });
  svc.getScheduleView.mockResolvedValue({ open247: false, days: [], closures: [] });
  svc.moderate.mockResolvedValue({ ok: true, shopId: "s-other", rating: 1 });
  svc.listForAdmin.mockResolvedValue({ items: [], total: 0, nextCursor: null });
});

describe("yonetici herhangi bir dukkanin fotograf ve saatini duzenler", () => {
  it("galeri, kapak ve silme URL'deki dukkana ADMIN kimligiyle gider", async () => {
    expect((await adminImages.POST(req("/admin/shops/s-other/images", photo()), ctx({ id: "s-other" })))?.status).toBe(200);
    expect(svc.galleryAdd).toHaveBeenCalledWith(
      expect.objectContaining({ shopId: "s-other", actorId: "admin-1", actorRole: "ADMIN" }),
    );
    expect((await adminImage.POST(req("/admin/shops/s-other/image", photo()), ctx({ id: "s-other" })))?.status).toBe(200);
    expect(svc.setShopImage).toHaveBeenCalledWith(expect.objectContaining({ shopId: "s-other", actorRole: "ADMIN" }));
    const del = await adminImageOne.DELETE(req("/admin/shops/s-other/images/i9", { method: "DELETE" }), ctx({ id: "s-other", imageId: "i9" }));
    expect(del?.status).toBe(200);
    expect(svc.galleryRemove).toHaveBeenCalledWith(expect.objectContaining({ shopId: "s-other", imageId: "i9" }));
  });

  it("haftalik saat ve izin URL'deki dukkana, ADMIN aktoruyle (denetim kaydi icin) gider", async () => {
    const res = await adminSchedule.PUT(req("/admin/shops/s-other/schedule", json("PUT", week)), ctx({ id: "s-other" }));
    expect(res?.status).toBe(200);
    expect(svc.saveWeeklyHours).toHaveBeenCalledWith("s-other", week.days, false, expect.objectContaining({ id: "admin-1", role: "ADMIN" }));
    await adminSchedule.DELETE(req("/admin/shops/s-other/schedule?closureId=c1", { method: "DELETE" }), ctx({ id: "s-other" }));
    expect(svc.removeClosure).toHaveBeenCalledWith("s-other", "c1", expect.objectContaining({ role: "ADMIN" }));
  });

  it("cakisma 409 ve listeyle doner (esnaf ucuyla ayni sozlesme)", async () => {
    svc.saveWeeklyHours.mockResolvedValue({ ok: false, code: "CONFLICT", conflicts: [{ bookingId: "b1" }] });
    const res = await adminSchedule.PUT(req("/admin/shops/s-other/schedule", json("PUT", week)), ctx({ id: "s-other" }));
    expect(res?.status).toBe(409);
    expect(await res?.json()).toEqual({ error: "schedule_conflict", conflicts: [{ bookingId: "b1" }] });
  });
});

describe("olmayan dukkan", () => {
  it("saat ucu dort yontemde de 404 doner, servise inmez", async () => {
    db.shop.findUnique.mockResolvedValue(null);
    const c = ctx({ id: "yok" });
    const yanitlar = [
      await adminSchedule.GET(req("/admin/shops/yok/schedule"), c),
      await adminSchedule.PUT(req("/admin/shops/yok/schedule", json("PUT", week)), ctx({ id: "yok" })),
      await adminSchedule.POST(
        req("/admin/shops/yok/schedule", json("POST", { startDate: "2099-01-01", endDate: "2099-01-01" })),
        ctx({ id: "yok" }),
      ),
      await adminSchedule.DELETE(req("/admin/shops/yok/schedule?closureId=c1", { method: "DELETE" }), ctx({ id: "yok" })),
    ];
    for (const r of yanitlar) {
      expect(r?.status).toBe(404);
      expect(await r?.json()).toEqual({ error: "not_found" });
    }
    expect(svc.getScheduleView).not.toHaveBeenCalled();
    expect(svc.saveWeeklyHours).not.toHaveBeenCalled();
    expect(svc.addClosure).not.toHaveBeenCalled();
    expect(svc.removeClosure).not.toHaveBeenCalled();
  });
});

describe("kapi", () => {
  it("esnaf ve misafir admin uclarinda 403 alir, servis cagrilmaz", async () => {
    for (const role of ["PARTNER", "GUEST"]) {
      session.user = { id: "u1", role, impersonatedBy: undefined };
      expect((await adminImages.POST(req("/admin/shops/s-other/images", photo()), ctx({ id: "s-other" })))?.status).toBe(403);
      expect((await adminImages.GET(req("/admin/shops/s-other/images"), ctx({ id: "s-other" })))?.status).toBe(403);
      expect((await adminSchedule.PUT(req("/admin/shops/s-other/schedule", json("PUT", week)), ctx({ id: "s-other" })))?.status).toBe(403);
      expect((await moderation.POST(req("/admin/reviews/r1/hide", json("POST", { reason: "Spam" })), ctx({ id: "r1", action: "hide" })))?.status).toBe(403);
      expect((await recentReviews.GET(req("/admin/reviews")))?.status).toBe(403);
    }
    expect(svc.galleryAdd).not.toHaveBeenCalled();
    expect(svc.saveWeeklyHours).not.toHaveBeenCalled();
    expect(svc.moderate).not.toHaveBeenCalled();
  });

  it("goruntuleme oturumunda yazma kapali, okuma acik", async () => {
    session.user = { id: "admin-2", role: "ADMIN", impersonatedBy: "admin-1" };
    const w = await adminSchedule.PUT(req("/admin/shops/s-other/schedule", json("PUT", week)), ctx({ id: "s-other" }));
    expect(w?.status).toBe(403);
    expect(await w?.json()).toEqual({ error: "not_allowed_while_impersonating" });
    expect((await adminImage.POST(req("/admin/shops/s-other/image", photo()), ctx({ id: "s-other" })))?.status).toBe(403);
    expect((await moderation.POST(req("/admin/reviews/r1/delete", json("POST", { reason: "Spam" })), ctx({ id: "r1", action: "delete" })))?.status).toBe(403);
    expect((await adminSchedule.GET(req("/admin/shops/s-other/schedule"), ctx({ id: "s-other" })))?.status).toBe(200);
    expect(svc.saveWeeklyHours).not.toHaveBeenCalled();
    expect(svc.setShopImage).not.toHaveBeenCalled();
    expect(svc.moderate).not.toHaveBeenCalled();
  });

  it("esnaf saat ucu yine yalniz KENDI dukkanina yazar; ADMIN'e acilmadi", async () => {
    session.user = { id: "partner-1", role: "PARTNER", impersonatedBy: undefined };
    svc.getShopByOwner.mockResolvedValue(null); // ?shop= baskasinin dukkani
    const res = await partnerSchedule.PUT(req("/partner/shop/schedule?shop=s-other", json("PUT", week)));
    expect(res?.status).toBe(404);
    expect(svc.getShopByOwner).toHaveBeenCalledWith("partner-1", "s-other");
    expect(svc.saveWeeklyHours).not.toHaveBeenCalled();

    session.user = { id: "admin-1", role: "ADMIN", impersonatedBy: undefined };
    expect((await partnerSchedule.PUT(req("/partner/shop/schedule", json("PUT", week))))?.status).toBe(403);
  });
});

describe("yorum moderasyon ucu", () => {
  it("gizleme ve silme gerekce ister; geri alma istemez", async () => {
    const r1 = await moderation.POST(req("/admin/reviews/r1/hide", json("POST", {})), ctx({ id: "r1", action: "hide" }));
    expect(r1?.status).toBe(400);
    expect(await r1?.json()).toEqual({ error: "reason_required" });
    const r2 = await moderation.POST(req("/admin/reviews/r1/delete", json("POST", { reason: "x" })), ctx({ id: "r1", action: "delete" }));
    expect(r2?.status).toBe(400);
    expect(svc.moderate).not.toHaveBeenCalled();

    const r3 = await moderation.POST(req("/admin/reviews/r1/unhide", { method: "POST" }), ctx({ id: "r1", action: "unhide" }));
    expect(r3?.status).toBe(200);
    expect(svc.moderate).toHaveBeenCalledWith(expect.objectContaining({ reviewId: "r1", action: "unhide", reason: null }));
  });

  it("servis govdesine aktorle gider, sonuc kodlari HTTP durumuna eslenir", async () => {
    const ok = await moderation.POST(req("/admin/reviews/r1/hide", json("POST", { reason: " Hakaret " })), ctx({ id: "r1", action: "hide" }));
    expect(ok?.status).toBe(200);
    expect(svc.moderate).toHaveBeenCalledWith(
      expect.objectContaining({ reviewId: "r1", action: "hide", reason: "Hakaret", actor: expect.objectContaining({ id: "admin-1" }) }),
    );
    svc.moderate.mockResolvedValueOnce({ ok: false, reason: "already_hidden" });
    expect((await moderation.POST(req("/admin/reviews/r1/hide", json("POST", { reason: "Tekrar" })), ctx({ id: "r1", action: "hide" })))?.status).toBe(409);
    svc.moderate.mockResolvedValueOnce({ ok: false, reason: "not_found" });
    expect((await moderation.POST(req("/admin/reviews/r1/delete", json("POST", { reason: "Spam" })), ctx({ id: "r1", action: "delete" })))?.status).toBe(404);
    expect((await moderation.POST(req("/admin/reviews/r1/nuke", json("POST", {})), ctx({ id: "r1", action: "nuke" })))?.status).toBe(400);
  });

  it("son yorumlar filtresi servise gecer; bilinmeyen deger 'all'", async () => {
    await recentReviews.GET(req("/admin/reviews?filter=low"));
    expect(svc.listForAdmin).toHaveBeenLastCalledWith(expect.objectContaining({ filter: "low" }));
    await recentReviews.GET(req("/admin/reviews?filter=drop"));
    expect(svc.listForAdmin).toHaveBeenLastCalledWith(expect.objectContaining({ filter: "all" }));
  });
});
