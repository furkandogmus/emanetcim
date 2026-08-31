/**
 * @vitest-environment node
 */
import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";

vi.unmock("@/lib/db");

vi.mock("@/services/NotificationService", () => ({
  notificationService: {
    sendEmail: vi.fn().mockResolvedValue(true),
    sendSms: vi.fn().mockResolvedValue(true),
    notifyAdminsForNewUser: vi.fn().mockResolvedValue(undefined),
  },
}));

/**
 * SAHIPLIK VE GORUNURLUK KURALLARI — entegrasyon kaniti.
 *
 * NEDEN BU DOSYA VAR: iki bulgu da bugune kadar KAYNAK TARAMASIYLA korunuyordu
 * (`ownership-scoping`, `shop-visibility-filter`). Tarama dogru fonksiyonun
 * CAGRILDIGINI dogruluyor ama o fonksiyonun DOGRU DAVRANDIGINI dogrulamiyor:
 * `getOperatingShopById` cagrilip icinde yanlis filtre olsaydi tarama yesil
 * kalirdi.
 *
 * Docker geldigi icin artik gercek satirlar yaratilip gercek kurallar
 * kosturulabiliyor. Yalnizca `CI=true` ve `DATABASE_URL` varken kosar.
 */
const runIntegration = process.env.CI === "true" && Boolean(process.env.DATABASE_URL);

describe.skipIf(!runIntegration)("sahiplik ve gorunurluk (integration)", () => {
  /* eslint-disable @typescript-eslint/no-explicit-any */
  let prisma: any;
  const suffix = `own-${Date.now()}`;
  const userIds: string[] = [];
  const shopIds: string[] = [];
  const serials: number[] = [];

  // Cakismasin diye zamana dayali, dar bir aralik.
  const serialBase = 900_000 + (Date.now() % 50_000);

  let partnerA: any, partnerB: any, shopA: any, shopB: any;

  beforeAll(async () => {
    prisma = (await import("@/lib/db")).default;

    partnerA = await prisma.user.create({
      data: { email: `pa-${suffix}@test.local`, name: "Esnaf A", role: "PARTNER" },
    });
    partnerB = await prisma.user.create({
      data: { email: `pb-${suffix}@test.local`, name: "Esnaf B", role: "PARTNER" },
    });
    userIds.push(partnerA.id, partnerB.id);

    shopA = await prisma.shop.create({
      data: { ownerId: partnerA.id, name: `A ${suffix}`, isActive: true, capacity: 10 },
    });
    shopB = await prisma.shop.create({
      data: { ownerId: partnerB.id, name: `B ${suffix}`, isActive: true, capacity: 10 },
    });
    shopIds.push(shopA.id, shopB.id);

    // B'nin dukkanina ATANMIS bir muhur: saldirinin hedefi.
    const s = await prisma.seal.create({
      data: { serialNumber: serialBase, shopId: shopB.id, status: "ASSIGNED" },
    });
    serials.push(s.serialNumber);
  });

  afterAll(async () => {
    if (!prisma) return;
    await prisma.seal.deleteMany({ where: { serialNumber: { in: serials } } });
    await prisma.shop.deleteMany({ where: { id: { in: shopIds } } });
    await prisma.user.deleteMany({ where: { id: { in: userIds } } });
  });

  describe("mühür: esnaf BASKA dukkanin muhrune dokunamaz", () => {
    it("A, B'nin muhrunu arizali isaretleyemez", async () => {
      /*
        ASIL SALDIRI: `shopId` istemciden geliyordu ve `requirePartner()`
        yalnizca "esnaf mi" diye soruyordu, "BU dukkanin esnafi mi" diye degil.
        Etkisi envanterle sinirli degil -- FAULTY muhur check-in'de
        reddedildigi icin hedef dukkanin TESLIM ALMA AKISI duruyordu.
      */
      const { sealService } = await import("@/services/SealService");

      await expect(
        sealService.markSealAsFaulty(serials[0], shopB.id, {
          id: partnerA.id,
          role: "PARTNER",
        }),
      ).rejects.toThrow("shop_not_owned_by_actor");

      const after = await prisma.seal.findUnique({
        where: { serialNumber: serials[0] },
      });
      expect(after.status, "muhur DOKUNULMAMIS kalmali").toBe("ASSIGNED");
    });

    it("B kendi muhrunu arizali isaretleyebilir", async () => {
      const { sealService } = await import("@/services/SealService");
      await sealService.markSealAsFaulty(serials[0], shopB.id, {
        id: partnerB.id,
        role: "PARTNER",
      });
      const after = await prisma.seal.findUnique({
        where: { serialNumber: serials[0] },
      });
      expect(after.status).toBe("FAULTY");
    });

    it("ADMIN sahiplik kontrolunden muaf", async () => {
      const { sealService } = await import("@/services/SealService");
      const s = await prisma.seal.create({
        data: { serialNumber: serialBase + 1, shopId: shopB.id, status: "ASSIGNED" },
      });
      serials.push(s.serialNumber);

      await sealService.markSealAsFaulty(s.serialNumber, shopB.id, {
        id: "herhangi-bir-admin",
        role: "ADMIN",
      });
      const after = await prisma.seal.findUnique({
        where: { serialNumber: s.serialNumber },
      });
      expect(after.status).toBe("FAULTY");
    });
  });

  describe("gorunurluk: test dukkani kamuya cikmaz, prelaunch rezervasyon almaz", () => {
    it("TEST dukkani misafir okumasindan duser", async () => {
      const { shopService } = await import("@/services/ShopService");
      await prisma.shop.update({ where: { id: shopA.id }, data: { isTest: true } });

      expect(
        await shopService.getPublicShopById(shopA.id),
        "test kaydi kamuya HIC gorunmez (P1-4)",
      ).toBeNull();

      await prisma.shop.update({ where: { id: shopA.id }, data: { isTest: false } });
      expect(await shopService.getPublicShopById(shopA.id)).not.toBeNull();
    });

    it("PRELAUNCH noktasi GORUNUR ama isletilen sayilmaz", async () => {
      /*
        Iki filtrenin ayrildigi tam nokta:
          "misafire gosterilsin mi?"  -> PUBLIC_SHOP_FILTER    (prelaunch DAHIL)
          "burada is yapiliyor mu?"   -> OPERATING_SHOP_FILTER (prelaunch HARIC)
      */
      const { shopService } = await import("@/services/ShopService");
      await prisma.shop.update({ where: { id: shopA.id }, data: { isPrelaunch: true } });

      expect(
        await shopService.getPublicShopById(shopA.id),
        "talep testi noktasi GORUNMELI -- olculen sey tiklama",
      ).not.toBeNull();
      expect(
        await shopService.getOperatingShopById(shopA.id),
        "ama rezervasyon ALMAMALI: o noktada slot hic uretilmiyor",
      ).toBeNull();

      await prisma.shop.update({ where: { id: shopA.id }, data: { isPrelaunch: false } });
    });

    it("pasif dukkan ikisinden de duser", async () => {
      const { shopService } = await import("@/services/ShopService");
      await prisma.shop.update({ where: { id: shopA.id }, data: { isActive: false } });
      expect(await shopService.getPublicShopById(shopA.id)).toBeNull();
      expect(await shopService.getOperatingShopById(shopA.id)).toBeNull();
      await prisma.shop.update({ where: { id: shopA.id }, data: { isActive: true } });
    });

    it("saglikli dukkan ikisinden de gecer", async () => {
      const { shopService } = await import("@/services/ShopService");
      expect(await shopService.getPublicShopById(shopA.id)).not.toBeNull();
      expect(await shopService.getOperatingShopById(shopA.id)).not.toBeNull();
    });
  });
});
