import { describe, it, expect, vi, beforeEach } from "vitest";
import fs from "node:fs";
import path from "node:path";

/**
 * Valiz fotografi yetki matrisi: kim gorur, kim ekler, kim siler; imzali adresin omru;
 * saklama isinin secimi; hesap silme. Her satir, kapisi kaldirilirsa kirilacak sekilde.
 */
const db = vi.hoisted(() => ({
  booking: { findUnique: vi.fn() },
  bagPhoto: {
    findMany: vi.fn(),
    findFirst: vi.fn(),
    count: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    updateMany: vi.fn(),
    delete: vi.fn(),
  },
}));
const storage = vi.hoisted(() => ({
  putPrivate: vi.fn(),
  presignGet: vi.fn(),
  remove: vi.fn(),
  exists: vi.fn(),
}));
const access = vi.hoisted(() => ({ operators: new Set<string>() }));
const rate = vi.hoisted(() => ({ allow: true }));
const audit = vi.hoisted(() => vi.fn());

vi.mock("@/lib/db", () => ({ default: db }));
vi.mock("@/lib/audit-log", () => ({ writeAuditLog: audit }));
vi.mock("@/lib/rate-limit", () => ({ rateLimit: vi.fn(async () => rate.allow) }));
vi.mock("@/lib/shop-access", () => ({
  hasShopAccess: vi.fn(async (actor: { id: string; role: string }) => actor.role === "ADMIN" || access.operators.has(actor.id)),
}));
vi.mock("@/lib/storage", async () => {
  const actual = await vi.importActual<typeof import("@/lib/storage/image-validation")>("@/lib/storage/image-validation");
  return { ...actual, getStorage: () => storage, isStorageConfigured: () => true };
});

import { bagPhotoService, prepareBagPhotoBytes } from "@/services/BagPhotoService";
import { BAG_PHOTO_MAX_BYTES, BAG_PHOTO_URL_TTL_SECONDS } from "@/lib/bag-photos";

const NOW = new Date("2026-11-25T10:00:00Z");
const BOOKING = "11111111-1111-4111-8111-111111111111";

const ADMIN = { id: "admin", role: "ADMIN" };
const OWNER = { id: "owner", role: "PARTNER" };
const STAFF = { id: "staff", role: "GUEST" };
const GUEST = { id: "guest", role: "GUEST" };
const STRANGER = { id: "stranger", role: "PARTNER" };
const VIEW_AS_GUEST = { ...GUEST, impersonatedBy: "admin" };

function booking(over: Record<string, unknown> = {}) {
  return { id: BOOKING, guestId: "guest", status: "APPROVED", checkedInAt: null, checkOutTime: new Date(NOW.getTime() + 86_400_000), shop: { id: "s1", ownerId: "owner" }, ...over };
}

/** SOI + SOF0 (640x480) + SOS + EOI: boyut okunabilen en kucuk JPEG. */
function jpeg(w = 640, h = 480): Uint8Array {
  return new Uint8Array([
    0xff, 0xd8,
    0xff, 0xe1, 0, 8, 0x45, 0x78, 0x69, 0x66, 0, 0, // APP1 "Exif"
    0xff, 0xc0, 0, 11, 8, h >> 8, h & 0xff, w >> 8, w & 0xff, 1, 1, 0x11, 0,
    0xff, 0xda, 0, 2, 0x12, 0x34,
    0xff, 0xd9,
  ]);
}

beforeEach(() => {
  vi.clearAllMocks();
  access.operators = new Set(["owner", "staff"]);
  rate.allow = true;
  db.booking.findUnique.mockResolvedValue(booking());
  db.bagPhoto.findMany.mockResolvedValue([{ id: "p1", key: `bag-photos/${BOOKING}/a.jpg`, createdAt: NOW }]);
  db.bagPhoto.count.mockResolvedValue(0);
  db.bagPhoto.create.mockResolvedValue({ id: "new" });
  db.bagPhoto.findFirst.mockResolvedValue({ id: "p1", key: `bag-photos/${BOOKING}/a.jpg` });
  db.bagPhoto.update.mockResolvedValue({});
  db.bagPhoto.delete.mockResolvedValue({});
  storage.presignGet.mockResolvedValue("https://s3.test/signed");
  storage.putPrivate.mockImplementation(async ({ key }: { key: string }) => ({ key }));
  storage.remove.mockResolvedValue(undefined);
  storage.exists.mockResolvedValue(true);
});

describe("goruntuleme (list)", () => {
  it.each([
    ["yonetici", ADMIN, true],
    ["sahip", OWNER, true],
    ["personel", STAFF, true],
    ["misafirin kendisi", GUEST, true],
    ["baska dukkanin esnafi", STRANGER, false],
  ])("%s", async (_l, actor, allowed) => {
    const r = await bagPhotoService.list(actor, BOOKING, NOW);
    expect(r.ok).toBe(allowed);
    if (!allowed) {
      expect(r).toEqual({ ok: false, reason: "forbidden" });
      expect(storage.presignGet).not.toHaveBeenCalled();
    }
  });

  it("yalniz operator eklenebilir gorur; yonetici silebilir; misafir hicbirini", async () => {
    const owner = await bagPhotoService.list(OWNER, BOOKING, NOW);
    const admin = await bagPhotoService.list(ADMIN, BOOKING, NOW);
    const guest = await bagPhotoService.list(GUEST, BOOKING, NOW);
    expect(owner).toMatchObject({ canUpload: true, canDelete: true });
    expect(admin).toMatchObject({ canUpload: false, canDelete: true });
    expect(guest).toMatchObject({ canUpload: false, canDelete: false });
  });

  it("goruntuleme oturumu okur ama yazamaz", async () => {
    const r = await bagPhotoService.list(VIEW_AS_GUEST, BOOKING, NOW);
    expect(r).toMatchObject({ ok: true, canUpload: false, canDelete: false });
  });

  it("imzali adres 5 dk gecerli ve herkese acik adres hic uretilmez", async () => {
    const r = await bagPhotoService.list(GUEST, BOOKING, NOW);
    expect(BAG_PHOTO_URL_TTL_SECONDS).toBe(300);
    expect(storage.presignGet).toHaveBeenCalledWith(`bag-photos/${BOOKING}/a.jpg`, 300);
    expect(r).toMatchObject({
      ok: true,
      photos: [{ id: "p1", url: "https://s3.test/signed", expiresAt: new Date(NOW.getTime() + 300_000).toISOString() }],
    });
    expect(db.bagPhoto.findMany.mock.calls[0][0].where).toEqual({ bookingId: BOOKING, deletedAt: null });
  });

  it("olmayan rezervasyon not_found", async () => {
    db.booking.findUnique.mockResolvedValue(null);
    expect(await bagPhotoService.list(ADMIN, BOOKING, NOW)).toEqual({ ok: false, reason: "not_found" });
  });
});

describe("yukleme (upload)", () => {
  it.each([
    ["sahip", OWNER, true],
    ["personel", STAFF, true],
    ["yonetici (fotografi dukkan ceker)", ADMIN, false],
    ["misafir", GUEST, false],
    ["baska esnaf", STRANGER, false],
  ])("%s", async (_l, actor, allowed) => {
    const r = await bagPhotoService.upload(actor, BOOKING, jpeg(), NOW);
    expect(r.ok).toBe(allowed);
    expect(storage.putPrivate).toHaveBeenCalledTimes(allowed ? 1 : 0);
  });

  it("ozel onek, JPEG ve EXIF temizlenmis govde ile yazar", async () => {
    await bagPhotoService.upload(OWNER, BOOKING, jpeg(), NOW);
    const put = storage.putPrivate.mock.calls[0][0];
    expect(put.key).toMatch(new RegExp(`^bag-photos/${BOOKING}/[0-9a-f-]+\\.jpg$`));
    expect(put.contentType).toBe("image/jpeg");
    expect(String.fromCharCode(...put.body)).not.toContain("Exif");
    expect(db.bagPhoto.create.mock.calls[0][0].data).toMatchObject({ bookingId: BOOKING, uploadedById: "owner" });
  });

  it("goruntulemede read_only, teslimden 60 dk sonra locked, limitte limit, hizda rate_limited", async () => {
    expect(await bagPhotoService.upload({ ...OWNER, impersonatedBy: "admin" }, BOOKING, jpeg(), NOW)).toEqual({ ok: false, reason: "read_only" });
    db.booking.findUnique.mockResolvedValueOnce(booking({ status: "CHECKED_IN", checkedInAt: new Date(NOW.getTime() - 61 * 60_000) }));
    expect(await bagPhotoService.upload(OWNER, BOOKING, jpeg(), NOW)).toEqual({ ok: false, reason: "locked" });
    db.bagPhoto.count.mockResolvedValueOnce(3);
    expect(await bagPhotoService.upload(OWNER, BOOKING, jpeg(), NOW)).toEqual({ ok: false, reason: "limit" });
    rate.allow = false;
    expect(await bagPhotoService.upload(OWNER, BOOKING, jpeg(), NOW)).toEqual({ ok: false, reason: "rate_limited" });
    expect(storage.putPrivate).not.toHaveBeenCalled();
  });

  it("kapidan gelen misafir: teslimden hemen sonra eklenebilir", async () => {
    db.booking.findUnique.mockResolvedValueOnce(booking({ status: "CHECKED_IN", checkedInAt: new Date(NOW.getTime() - 5 * 60_000) }));
    expect((await bagPhotoService.upload(STAFF, BOOKING, jpeg(), NOW)).ok).toBe(true);
  });

  it("es zamanli yukleme siniri asarsa en yeni geri alinir", async () => {
    db.bagPhoto.count.mockResolvedValueOnce(2).mockResolvedValueOnce(4);
    expect(await bagPhotoService.upload(OWNER, BOOKING, jpeg(), NOW)).toEqual({ ok: false, reason: "limit" });
    expect(db.bagPhoto.update).toHaveBeenCalledWith({ where: { id: "new" }, data: { deletedAt: NOW } });
  });
});

describe("prepareBagPhotoBytes", () => {
  it("bos, buyuk, JPEG olmayan ve devasa cozunurluk reddedilir", () => {
    expect(prepareBagPhotoBytes(new Uint8Array())).toEqual({ ok: false, reason: "empty" });
    expect(prepareBagPhotoBytes(new Uint8Array(BAG_PHOTO_MAX_BYTES + 1))).toEqual({ ok: false, reason: "too_large" });
    const png = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 13, 0x49, 0x48, 0x44, 0x52, 0, 0, 1, 0, 0, 0, 1, 0]);
    expect(prepareBagPhotoBytes(png)).toEqual({ ok: false, reason: "unsupported_type" });
    expect(prepareBagPhotoBytes(jpeg(5000, 3000))).toEqual({ ok: false, reason: "dimensions_too_large" });
    expect(prepareBagPhotoBytes(jpeg()).ok).toBe(true);
  });
});

describe("silme (remove)", () => {
  const late = () => booking({ status: "CHECKED_IN", checkedInAt: new Date(NOW.getTime() - 2 * 60 * 60_000) });

  it.each([
    ["sahip (pencere acik)", OWNER, true],
    ["personel (pencere acik)", STAFF, true],
    ["yonetici", ADMIN, true],
    ["misafir", GUEST, false],
    ["baska esnaf", STRANGER, false],
  ])("%s", async (_l, actor, allowed) => {
    const r = await bagPhotoService.remove(actor, BOOKING, "p1", NOW);
    expect(r.ok).toBe(allowed);
    expect(storage.remove).toHaveBeenCalledTimes(allowed ? 1 : 0);
  });

  it("teslimden sonra operator silemez, yonetici siler ve denetim kaydi yazar", async () => {
    db.booking.findUnique.mockResolvedValue(late());
    expect(await bagPhotoService.remove(OWNER, BOOKING, "p1", NOW)).toEqual({ ok: false, reason: "locked" });
    expect(await bagPhotoService.remove(ADMIN, BOOKING, "p1", NOW)).toEqual({ ok: true });
    expect(audit).toHaveBeenCalledWith(expect.objectContaining({ action: "admin.booking.bag_photo_delete", entityId: BOOKING }));
  });

  it("goruntulemede read_only; nesne silinemezse satir isaretli kalir (is yeniden dener)", async () => {
    expect(await bagPhotoService.remove({ ...ADMIN, impersonatedBy: "x" }, BOOKING, "p1", NOW)).toEqual({ ok: false, reason: "read_only" });
    storage.remove.mockRejectedValueOnce(new Error("s3 down"));
    expect(await bagPhotoService.remove(OWNER, BOOKING, "p1", NOW)).toEqual({ ok: true });
    expect(db.bagPhoto.update).toHaveBeenCalledWith({ where: { id: "p1" }, data: { deletedAt: NOW } });
    expect(db.bagPhoto.delete).not.toHaveBeenCalled();
  });
});

describe("saklama isi (runRetention)", () => {
  const DAY = 24 * 60 * 60 * 1000;
  const row = (id: string, booking: Record<string, unknown>, deletedAt: Date | null = null) => ({
    id,
    key: `bag-photos/b/${id}.jpg`,
    deletedAt,
    booking: {
      status: "CHECKED_OUT",
      checkedOutAt: new Date(NOW.getTime() - 40 * DAY),
      checkOutTime: new Date(NOW.getTime() - 40 * DAY),
      updatedAt: NOW,
      dispute: null,
      ...booking,
    },
  });

  it("acik itirazli fotograf aday sorgusunda elenir ve silinmez; suresi dolanlar silinir", async () => {
    db.bagPhoto.findMany.mockResolvedValueOnce([
      row("due", {}),
      row("open", { dispute: { status: "OPEN", updatedAt: NOW } }),
      row("closedRecently", { dispute: { status: "RESOLVED", updatedAt: new Date(NOW.getTime() - 3 * DAY) } }),
      row("marked", { status: "CHECKED_IN", checkedOutAt: null, checkOutTime: NOW }, NOW),
    ]).mockResolvedValueOnce([]);
    const r = await bagPhotoService.runRetention(NOW);
    expect(r).toEqual({ scanned: 4, removed: 2, failed: 0, kept: 2, missing: 0 });
    expect(storage.remove.mock.calls.map((c) => c[0])).toEqual(["bag-photos/b/due.jpg", "bag-photos/b/marked.jpg"]);
    const where = db.bagPhoto.findMany.mock.calls[0][0].where;
    expect(JSON.stringify(where)).toContain('"NOT":{"dispute":{"status":{"in":["OPEN","IN_REVIEW"]}}}');
    expect(JSON.stringify(where)).toContain('"status":{"notIn":["CHECKED_OUT","CANCELLED"]},"checkOutTime"');
  });

  it("S3'te nesnesi olmayan canli satir silinir; HEAD hatasi yok sayilmaz", async () => {
    db.bagPhoto.findMany.mockResolvedValueOnce([]).mockResolvedValueOnce([
      { id: "gone", key: "bag-photos/b/gone.jpg" },
      { id: "here", key: "bag-photos/b/here.jpg" },
      { id: "err", key: "bag-photos/b/err.jpg" },
    ]);
    storage.exists.mockImplementation(async (k: string) => {
      if (k.includes("err")) throw new Error("AccessDenied");
      return !k.includes("gone");
    });
    const r = await bagPhotoService.runRetention(NOW);
    expect(r.missing).toBe(1);
    expect(db.bagPhoto.delete).toHaveBeenCalledTimes(1);
    expect(db.bagPhoto.delete).toHaveBeenCalledWith({ where: { id: "gone" } });
    expect(storage.presignGet).not.toHaveBeenCalled();
  });

  it("nesne silinemezse satir kalir ve failed sayilir", async () => {
    db.bagPhoto.findMany.mockResolvedValue([row("due", {})]);
    storage.remove.mockRejectedValueOnce(new Error("s3 down"));
    expect(await bagPhotoService.runRetention(NOW)).toMatchObject({ removed: 0, failed: 1 });
    expect(db.bagPhoto.delete).not.toHaveBeenCalled();
  });
});

describe("KVKK", () => {
  it("hesap silme: acik itirazi olmayan rezervasyonlarin fotograflari isaretlenir", async () => {
    db.bagPhoto.updateMany.mockResolvedValue({ count: 2 });
    await bagPhotoService.markForGuestErasure(db as never, "guest", NOW);
    expect(db.bagPhoto.updateMany).toHaveBeenCalledWith({
      where: {
        deletedAt: null,
        booking: { guestId: "guest", OR: [{ dispute: null }, { dispute: { status: { notIn: ["OPEN", "IN_REVIEW"] } } }] },
      },
      data: { deletedAt: NOW },
    });
  });

  it("silme govdesi isaretler, disa aktarim yalniz meta veri listeler", () => {
    const privacy = fs.readFileSync(path.join(process.cwd(), "src/services/AccountPrivacyService.ts"), "utf8");
    const body = privacy.slice(privacy.indexOf("private async eraseWithinTx"));
    expect(body).toMatch(/bagPhotoService\.markForGuestErasure\(tx, userId/);
    const exportSrc = fs.readFileSync(path.join(process.cwd(), "src/services/AccountDataExportService.ts"), "utf8");
    expect(exportSrc).toMatch(/bagPhotos: \{ where: \{ deletedAt: null \},.*select: \{ id: true, createdAt: true \} \}/);
    expect(exportSrc).not.toMatch(/bagPhoto[\s\S]{0,200}key: true/);
  });
});
