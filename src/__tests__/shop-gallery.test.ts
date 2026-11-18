import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * Esnaf galerisi: baskasinin dukkanina, sinir ustune ya da gorsel olmayan dosyayla
 * S3'e HIC yazilmamali; kapak degisimi nesne silmeden iki adresi takas etmeli.
 */
const db = vi.hoisted(() => ({
  shop: { findUnique: vi.fn(), update: vi.fn() },
  shopImage: { count: vi.fn(), findFirst: vi.fn(), create: vi.fn(), delete: vi.fn(), update: vi.fn(), findMany: vi.fn() },
  $transaction: vi.fn(),
}));
const storage = vi.hoisted(() => ({
  put: vi.fn(),
  remove: vi.fn(),
  publicUrl: (k: string) => `https://cdn.test/${k}`,
}));
const validate = vi.hoisted(() => vi.fn());

vi.mock("@/lib/db", () => ({ default: db }));
vi.mock("@/lib/storage", () => ({
  getStorage: () => storage,
  validateImageBytes: validate,
  buildObjectKey: ({ prefix, ownerId }: { prefix: string; ownerId: string }) => `${prefix}/${ownerId}/x.jpg`,
}));
vi.mock("@/services/ShopService", () => ({
  extractKeyFromUrl: (url: string) => url.replace("https://cdn.test/", ""),
}));

import { MAX_GALLERY_IMAGES, ShopGalleryService } from "@/services/ShopGalleryService";

const actor = { shopId: "s1", actorId: "u1", actorRole: "PARTNER" as const };
const bytes = new Uint8Array([1, 2, 3]);

describe("ShopGalleryService", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    db.shop.findUnique.mockResolvedValue({ ownerId: "u1", image: "https://cdn.test/shops/s1/cover.jpg" });
    db.shopImage.count.mockResolvedValue(0);
    db.shopImage.findFirst.mockResolvedValue(null);
    db.shopImage.create.mockResolvedValue({ id: "i1", url: "https://cdn.test/shops/s1/x.jpg" });
    validate.mockReturnValue({ ok: true, extension: "jpg", contentType: "image/jpeg" });
    storage.put.mockResolvedValue({ url: "https://cdn.test/shops/s1/x.jpg" });
    storage.remove.mockResolvedValue(undefined);
  });

  it("baskasinin dukkanina yuklemez", async () => {
    db.shop.findUnique.mockResolvedValue({ ownerId: "baska", image: null });
    const r = await new ShopGalleryService().add({ ...actor, bytes });
    expect(r).toEqual({ ok: false, reason: "not_owner" });
    expect(storage.put).not.toHaveBeenCalled();
  });

  it("sinira ulasinca ve gecersiz dosyada S3'e yazmaz", async () => {
    db.shopImage.count.mockResolvedValueOnce(MAX_GALLERY_IMAGES);
    expect(await new ShopGalleryService().add({ ...actor, bytes })).toEqual({ ok: false, reason: "limit" });
    validate.mockReturnValueOnce({ ok: false, reason: "unsupported_type" });
    expect(await new ShopGalleryService().add({ ...actor, bytes })).toEqual({ ok: false, reason: "unsupported_type" });
    expect(storage.put).not.toHaveBeenCalled();
  });

  it("yeni fotografi sona ekler", async () => {
    db.shopImage.findFirst.mockResolvedValueOnce({ order: 4 });
    const r = await new ShopGalleryService().add({ ...actor, bytes });
    expect(r).toMatchObject({ ok: true, id: "i1" });
    expect(db.shopImage.create.mock.calls[0][0].data).toMatchObject({ shopId: "s1", order: 5 });
  });

  it("silerken once satiri, sonra nesneyi siler", async () => {
    db.shopImage.findFirst.mockResolvedValueOnce({ url: "https://cdn.test/shops/s1/g.jpg" });
    expect(await new ShopGalleryService().remove({ ...actor, imageId: "i9" })).toEqual({ ok: true });
    expect(db.shopImage.delete).toHaveBeenCalledWith({ where: { id: "i9" } });
    expect(storage.remove).toHaveBeenCalledWith("shops/s1/g.jpg");
  });

  it("kapak yaparken adresleri takas eder, nesne silmez", async () => {
    db.shopImage.findFirst.mockResolvedValueOnce({ url: "https://cdn.test/shops/s1/g.jpg" });
    expect(await new ShopGalleryService().makeCover({ ...actor, imageId: "i9" })).toEqual({ ok: true });
    expect(db.shop.update).toHaveBeenCalledWith({ where: { id: "s1" }, data: { image: "https://cdn.test/shops/s1/g.jpg" } });
    expect(db.shopImage.update).toHaveBeenCalledWith({
      where: { id: "i9" },
      data: { url: "https://cdn.test/shops/s1/cover.jpg" },
    });
    expect(storage.remove).not.toHaveBeenCalled();
  });
});
