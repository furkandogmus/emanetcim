import { describe, it, expect, vi, beforeEach } from "vitest";

const { mockPrisma, mockPut, mockRemove } = vi.hoisted(() => ({
  mockPut: vi.fn(),
  mockRemove: vi.fn().mockResolvedValue(undefined),
  mockPrisma: { shop: { findUnique: vi.fn(), update: vi.fn() } },
}));
vi.mock("@/lib/db", () => ({ default: mockPrisma }));
vi.mock("@/lib/storage", async (orig) => {
  const actual = await orig<typeof import("@/lib/storage")>();
  return {
    ...actual,
    getStorage: () => ({
      put: mockPut,
      remove: mockRemove,
      publicUrl: (k: string) => `https://cdn.test/${k}`,
      capabilities: { id: "test", servesPublicUrls: true },
    }),
  };
});

import { shopService } from "@/services/ShopService";
import { Role } from "@prisma/client";

const JPEG = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, ...Array(20).fill(0)]);
const BASE = { shopId: "s1", actorId: "owner-1", actorRole: Role.PARTNER, bytes: JPEG };

beforeEach(() => {
  vi.clearAllMocks();
  mockPrisma.shop.findUnique.mockResolvedValue({ ownerId: "owner-1", image: null });
  mockPrisma.shop.update.mockResolvedValue({ id: "s1" });
  mockPut.mockImplementation(async ({ key }: { key: string }) => ({
    key, url: `https://cdn.test/${key}`,
  }));
});

/**
 * Vitrin fotoğrafı. `Shop.image` misafir vitrininde çiziliyordu ama kod
 * tabanında ona YAZAN tek bir satır yoktu.
 */
describe("dükkan vitrin fotoğrafı", () => {
  it("doğrulanmış türle yükler ve adresi kaydeder", async () => {
    const res = await shopService.setShopImage(BASE);
    expect(res.ok).toBe(true);
    // Tur SUNUCUDA belirleniyor; istemcinin beyani hic okunmuyor.
    expect(mockPut).toHaveBeenCalledWith(
      expect.objectContaining({ contentType: "image/jpeg" }),
    );
    expect(mockPrisma.shop.update).toHaveBeenCalledWith({
      where: { id: "s1" },
      data: { image: expect.stringContaining("https://cdn.test/shops/s1/") },
    });
  });

  it("BAŞKASININ dükkanına yükletmez — ve S3'e HİÇ dokunmaz", async () => {
    /*
      Sira onemli: sahiplik once bakiliyor. Yukleme en pahali ve geri alinmasi
      en zor adim; baskasinin dukkani icin S3'e yazmak istemeyiz.
    */
    mockPrisma.shop.findUnique.mockResolvedValue({ ownerId: "baskasi", image: null });
    const res = await shopService.setShopImage(BASE);
    expect(res).toEqual({ ok: false, reason: "not_owner" });
    expect(mockPut).not.toHaveBeenCalled();
  });

  it("ADMIN sahiplik kontrolünü atlar", async () => {
    mockPrisma.shop.findUnique.mockResolvedValue({ ownerId: "baskasi", image: null });
    const res = await shopService.setShopImage({ ...BASE, actorRole: Role.ADMIN });
    expect(res.ok).toBe(true);
  });

  it("GÖRSEL OLMAYAN dosyayı S3'e yazmadan reddeder", async () => {
    // `evil.html` `image/jpeg` diye gonderilse bile ilk baytlar ele veriyor.
    const html = new Uint8Array([...Buffer.from("<html><script>x</script>")]);
    const res = await shopService.setShopImage({ ...BASE, bytes: html });
    expect(res).toEqual({ ok: false, reason: "unsupported_type" });
    expect(mockPut).not.toHaveBeenCalled();
    expect(mockPrisma.shop.update).not.toHaveBeenCalled();
  });

  it("ESKİ nesneyi siler ama önce YENİSİNİ yazar", async () => {
    /*
      Sira tersine olsaydi, yazma basarisiz oldugunda dukkan fotografsiz
      kalirdi. Bu sirada en kotu ihtimal kovada yetim bir nesnedir.
    */
    mockPrisma.shop.findUnique.mockResolvedValue({
      ownerId: "owner-1", image: "https://cdn.test/shops/s1/eski.jpg",
    });
    await shopService.setShopImage(BASE);
    expect(mockPut).toHaveBeenCalled();
    expect(mockRemove).toHaveBeenCalledWith("shops/s1/eski.jpg");
  });

  it("TANIMADIĞI kök adresteki eski nesneyi silmeye ÇALIŞMAZ", async () => {
    // CDN alan adi degistiyse yanlis bir anahtari silmeye calismaktansa
    // yetim nesne birakmak yeglenir.
    mockPrisma.shop.findUnique.mockResolvedValue({
      ownerId: "owner-1", image: "https://baska-cdn.example/x/y.jpg",
    });
    await shopService.setShopImage(BASE);
    expect(mockRemove).not.toHaveBeenCalled();
  });

  it("eski nesne silinemezse yükleme yine BAŞARILI sayılır", async () => {
    mockPrisma.shop.findUnique.mockResolvedValue({
      ownerId: "owner-1", image: "https://cdn.test/shops/s1/eski.jpg",
    });
    mockRemove.mockRejectedValue(new Error("s3 down"));
    const res = await shopService.setShopImage(BASE);
    expect(res.ok).toBe(true);
  });
});
