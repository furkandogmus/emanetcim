import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * "AÇILDIĞI GÜN İLK SEN HABERDAR OL" — sözün karşılığı.
 *
 * NEDEN BU DOSYA VAR (2026-08-31'de ölçüldü): `PrelaunchInterest` kayıtları
 * yalnızca YAZILIYOR ve SAYILIYOR'du. Onlardan bir şey gönderen tek satır kod
 * yoktu — `grep` ile doğrulandı. Oysa kişi e-postasını tam olarak o söz
 * karşılığında bırakıyor; yani ürünün en değerli sinyali, karşılığı olmayan bir
 * vaat üzerine toplanıyordu.
 *
 * Bu sınıf hata sessizdir: kimse hata almaz, kimse şikâyet etmez, e-postalar
 * tabloda birikir ve özellik "çalışıyor" görünür.
 */
const { mockPrisma, mockNotify, mockConfirm } = vi.hoisted(() => ({
  mockPrisma: {
    shop: { findUnique: vi.fn() },
    prelaunchInterest: {
      findMany: vi.fn(),
      count: vi.fn(),
      update: vi.fn(),
      create: vi.fn(),
    },
  },
  mockNotify: vi.fn(),
  mockConfirm: vi.fn(),
}));

vi.mock("@/lib/db", () => ({ default: mockPrisma }));
vi.mock("@/lib/logger", () => ({
  default: { error: vi.fn(), warn: vi.fn(), info: vi.fn() },
}));
vi.mock("@/services/NotificationService", () => ({
  notificationService: {
    notifyPrelaunchOpened: mockNotify,
    notifyPrelaunchInterestReceived: mockConfirm,
  },
}));

import { prelaunchInterestService } from "@/services/PrelaunchInterestService";

beforeEach(() => {
  vi.clearAllMocks();
  mockPrisma.shop.findUnique.mockResolvedValue({ name: "Taksim", isPrelaunch: false });
  mockPrisma.prelaunchInterest.count.mockResolvedValue(0);
  mockPrisma.prelaunchInterest.update.mockResolvedValue({});
  mockNotify.mockResolvedValue(undefined);
});

describe("notifyOpened", () => {
  it("haber bekleyen herkese gonderir ve DAMGALAR", async () => {
    mockPrisma.prelaunchInterest.findMany.mockResolvedValue([
      { id: "i1", email: "a@x.com", locale: "tr" },
      { id: "i2", email: "b@x.com", locale: "ja" },
    ]);

    const res = await prelaunchInterestService.notifyOpened("s1");

    expect(res).toMatchObject({ sent: 2, failed: 0 });
    expect(mockNotify).toHaveBeenCalledTimes(2);
    // Kisinin KENDI dilinde: e-posta uygulamanin geri kalani gibi cevrilmeli.
    expect(mockNotify).toHaveBeenCalledWith("b@x.com", "s1", "Taksim", "ja");
    expect(mockPrisma.prelaunchInterest.update).toHaveBeenCalledTimes(2);
  });

  it("daha once bildirilmis olana IKINCI KEZ gondermez", async () => {
    /**
     * Sorgu `notifiedAt: null` ile daraltiliyor. Bir pazarlama e-postasini iki
     * kez gondermek, hic gondermemekten daha cok zarar verir.
     */
    mockPrisma.prelaunchInterest.findMany.mockResolvedValue([]);
    mockPrisma.prelaunchInterest.count.mockResolvedValue(5);

    const res = await prelaunchInterestService.notifyOpened("s1");

    expect(res).toEqual({ sent: 0, failed: 0, alreadyNotified: 5 });
    expect(mockNotify).not.toHaveBeenCalled();
    expect(mockPrisma.prelaunchInterest.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ notifiedAt: null }),
      }),
    );
  });

  it("nokta HALA prelaunch ise HICBIR SEY gondermez", async () => {
    /**
     * Ters sirada cagrilan bir betik, yuzlerce kisiye "acildi" der ve gelen
     * kisi rezervasyon alamaz. Bos vaat, sessizlikten kotudur.
     */
    mockPrisma.shop.findUnique.mockResolvedValue({ name: "Taksim", isPrelaunch: true });

    const res = await prelaunchInterestService.notifyOpened("s1");

    expect(res).toEqual({ sent: 0, failed: 0, alreadyNotified: 0 });
    expect(mockNotify).not.toHaveBeenCalled();
  });

  it("bir adres patlarsa DIGERLERI yine gonderilir ve basarisiz DAMGALANMAZ", async () => {
    mockPrisma.prelaunchInterest.findMany.mockResolvedValue([
      { id: "i1", email: "bad@x.com", locale: "tr" },
      { id: "i2", email: "ok@x.com", locale: "tr" },
    ]);
    mockNotify.mockRejectedValueOnce(new Error("smtp down"));

    const res = await prelaunchInterestService.notifyOpened("s1");

    expect(res).toMatchObject({ sent: 1, failed: 1 });
    // Yalnizca basarili olan damgalandi -> digeri bir sonraki kosuda denenir.
    expect(mockPrisma.prelaunchInterest.update).toHaveBeenCalledTimes(1);
    expect(mockPrisma.prelaunchInterest.update).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: "i2" } }),
    );
  });

  it("olmayan dukkanda sessizce hicbir sey yapmaz", async () => {
    mockPrisma.shop.findUnique.mockResolvedValue(null);
    const res = await prelaunchInterestService.notifyOpened("yok");
    expect(res).toEqual({ sent: 0, failed: 0, alreadyNotified: 0 });
  });
});

describe("record — kayit teyidi", () => {
  beforeEach(() => {
    mockPrisma.shop.findUnique.mockResolvedValue({
      isPrelaunch: true,
      name: "Tour Eiffel",
    });
    mockPrisma.prelaunchInterest.create.mockResolvedValue({});
    mockConfirm.mockResolvedValue(undefined);
  });

  it("kayit alininca TEYIT gonderilir", async () => {
    /**
     * Once yalnizca ekranda bir toast cikiyordu. Iki sonucu vardi ve ikisi de
     * sessizdi: yazim hatali bir adres sessizce kabul ediliyordu (kisi acilis
     * gununde hicbir sey almazdi ve bunu HIC ogrenemezdi), ve kisinin elinde
     * kayit kalmiyordu.
     */
    const res = await prelaunchInterestService.record({
      shopId: "s1",
      email: "A@Example.com",
      locale: "ja",
    });

    expect(res).toEqual({ ok: true, alreadyRegistered: false });
    // E-posta kucuk harfe indirilerek saklaniyor; teyit de ayni adrese gider.
    expect(mockConfirm).toHaveBeenCalledWith(
      "a@example.com",
      "s1",
      "Tour Eiffel",
      "ja",
    );
  });

  it("teyit patlarsa KAYIT yine basarili sayilir", async () => {
    // Kayit zaten yazildi; kisiye "kaydolamadin" demek YANLIS olurdu.
    mockConfirm.mockRejectedValue(new Error("smtp down"));

    const res = await prelaunchInterestService.record({
      shopId: "s1",
      email: "b@example.com",
    });

    expect(res).toEqual({ ok: true, alreadyRegistered: false });
  });
});
