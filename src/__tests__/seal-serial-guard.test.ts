import { describe, it, expect, vi } from "vitest";

/**
 * MUHUR SERI NUMARASI POZITIF OLMAK ZORUNDA.
 *
 * Gercek veritabaninda olculdu (2026-09-02): `bulkCreateSeals` uc kontrol
 * yapiyordu -- tam sayi, sira, aralik genisligi -- ve UCU DE negatif bir
 * araligi geciriyordu:
 *
 *     bulkCreateSeals(-100, -50) -> 51 muhur olusturuldu
 *     bulkCreateSeals(0, 5)      ->  6 muhur olusturuldu
 *
 * Bunlar OLU STOK. Check-in govdesi `sealNumber: z.number().int().positive()`
 * istiyor, yani negatif ya da sifir numarali bir muhur hicbir zaman bir valize
 * BAGLANAMAZ -- ama envanter sayimlarina giriyor: dukkan stok rozeti,
 * `getSealCounts` ve `seal-forecast`in yeniden siparis esigi.
 *
 * Sonuc sinsi: sistem var olmayan bir stogu var saniyor, gercek muhurler
 * bittiginde otomatik talep esigi tetiklenmiyor ve esnaf muhursuz kaliyor.
 *
 * Sistemin geri kalani zaten pozitif varsayiyordu; uretim tarafi bunu
 * zorlamiyordu -- ayni oturumda yedinci kez cikan "kural bir yerde var,
 * digerinde yok" sinifi.
 */

const { mockPrisma } = vi.hoisted(() => ({
  mockPrisma: { seal: { createMany: vi.fn() } },
}));
vi.mock("@/lib/db", () => ({ default: mockPrisma }));

const { sealService } = await import("@/services/SealService");

async function hatayiYakala(from: number, to: number) {
  mockPrisma.seal.createMany.mockClear();
  mockPrisma.seal.createMany.mockResolvedValue({ count: 0 });
  try {
    await sealService.bulkCreateSeals(from, to);
    return null;
  } catch (e) {
    return String((e as Error).message);
  }
}

describe("muhur uretim araligi", () => {
  it.each([
    ["tamamen negatif", -100, -50],
    ["sifirdan baslayan", 0, 5],
    ["negatiften pozitife", -10, 10],
  ])("%s aralik reddediliyor", async (_ad, from, to) => {
    expect(await hatayiYakala(from, to)).toBe("invalid_range");
    expect(
      mockPrisma.seal.createMany,
      "gecersiz aralik veritabanina GITMEMELI",
    ).not.toHaveBeenCalled();
  });

  it("ters sira reddediliyor", async () => {
    expect(await hatayiYakala(500, 100)).toBe("invalid_range");
  });

  it("kesirli numara reddediliyor", async () => {
    expect(await hatayiYakala(1.5, 10)).toBe("invalid_range");
  });

  it("cok genis aralik reddediliyor", async () => {
    // Elli bin ustu tek seferde uretilmez.
    expect(await hatayiYakala(1, 100_000)).toBe("range_too_large");
  });

  it("gecerli aralik KABUL ediliyor", async () => {
    mockPrisma.seal.createMany.mockClear();
    mockPrisma.seal.createMany.mockResolvedValue({ count: 3 });
    const r = await sealService.bulkCreateSeals(900_000, 900_002);
    expect(r.created).toBe(3);
    const veri = mockPrisma.seal.createMany.mock.calls[0][0].data;
    expect(veri).toHaveLength(3);
    expect(veri.every((d: { serialNumber: number }) => d.serialNumber > 0)).toBe(true);
  });

  it("1'den baslayan aralik gecerli -- sinir DAHIL", async () => {
    mockPrisma.seal.createMany.mockClear();
    mockPrisma.seal.createMany.mockResolvedValue({ count: 5 });
    expect(await hatayiYakala(1, 5)).toBeNull();
  });
});
