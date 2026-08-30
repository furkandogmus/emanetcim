import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * TEK TIKLIK istek sayaci.
 *
 * NEDEN OLCULUYOR: bir sehirde esnaf aramak on binlerce dolarlik bir taahhut ve
 * karar tam da bu sayiya bakilarak veriliyor. Sisirilebilen bir sayi, karari
 * yanlis yone cevirir -- yani buradaki dedupe bir "guzellik" degil, olcumun
 * kendisi. Ayni tarayicinin ikinci tiki SAYILMAMALI ama HATA da vermemeli:
 * kisinin istedigi sey zaten olmustur.
 */

const { mockPrisma } = vi.hoisted(() => ({
  mockPrisma: {
    shop: { findUnique: vi.fn() },
    prelaunchWant: { create: vi.fn(), count: vi.fn() },
  },
}));

vi.mock("@/lib/db", () => ({ default: mockPrisma }));
vi.mock("@/lib/logger", () => ({
  default: { error: vi.fn(), warn: vi.fn(), info: vi.fn() },
}));

import { Prisma } from "@prisma/client";
import { prelaunchInterestService } from "@/services/PrelaunchInterestService";

const INPUT = { shopId: "shop-1", anonId: "anon-1" };

function uniqueViolation() {
  return new Prisma.PrismaClientKnownRequestError("dup", {
    code: "P2002",
    clientVersion: "7",
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  mockPrisma.shop.findUnique.mockResolvedValue({ isPrelaunch: true });
  mockPrisma.prelaunchWant.create.mockResolvedValue({});
  mockPrisma.prelaunchWant.count.mockResolvedValue(7);
});

describe("recordWant", () => {
  it("ilk tik sayilir ve TAZE toplam doner", async () => {
    const res = await prelaunchInterestService.recordWant(INPUT);

    expect(res).toEqual({ ok: true, alreadyCounted: false, count: 7 });
    expect(mockPrisma.prelaunchWant.create).toHaveBeenCalledOnce();
  });

  it("ayni tarayicinin ikinci tiki HATA DEGIL, ama sayilmaz", async () => {
    mockPrisma.prelaunchWant.create.mockRejectedValue(uniqueViolation());
    mockPrisma.prelaunchWant.count.mockResolvedValue(7);

    const res = await prelaunchInterestService.recordWant(INPUT);

    // Kullaniciya hata gosterilmez; istedigi sey zaten olmus durumda.
    expect(res).toEqual({ ok: true, alreadyCounted: true, count: 7 });
  });

  it("sayi tekrar tiktan sonra ARTMAZ", async () => {
    await prelaunchInterestService.recordWant(INPUT);

    mockPrisma.prelaunchWant.create.mockRejectedValue(uniqueViolation());
    const second = await prelaunchInterestService.recordWant(INPUT);

    expect(second.ok && second.count).toBe(7);
  });

  it("isletilen dukkana istek yazilmaz", async () => {
    /**
     * Nokta hizmete acildiginda dogru eylem rezervasyon yapmaktir. Kontrol
     * olmasaydi onbellege alinmis eski bir sayfa acilmis bir dukkan icin
     * "istiyorum" yazmaya devam eder, kisi rezervasyon yapabilecegini hic
     * ogrenmezdi.
     */
    mockPrisma.shop.findUnique.mockResolvedValue({ isPrelaunch: false });

    const res = await prelaunchInterestService.recordWant(INPUT);

    expect(res).toEqual({ ok: false, code: "shop_not_prelaunch" });
    expect(mockPrisma.prelaunchWant.create).not.toHaveBeenCalled();
  });

  it("olmayan dukkan icin yazmaz", async () => {
    mockPrisma.shop.findUnique.mockResolvedValue(null);

    const res = await prelaunchInterestService.recordWant(INPUT);

    expect(res).toEqual({ ok: false, code: "shop_not_found" });
    expect(mockPrisma.prelaunchWant.create).not.toHaveBeenCalled();
  });

  it("P2002 disindaki hatalar YUTULMAZ", async () => {
    // Sessizce 0 donmek, bozuk bir olcumu saglikli gostermek olurdu.
    mockPrisma.prelaunchWant.create.mockRejectedValue(new Error("db down"));

    await expect(prelaunchInterestService.recordWant(INPUT)).rejects.toThrow(
      "db down",
    );
  });
});
