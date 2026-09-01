import { describe, it, expect, vi, beforeEach } from "vitest";

const { mockFindMany } = vi.hoisted(() => ({ mockFindMany: vi.fn() }));
vi.mock("@/lib/db", () => ({ default: {} }));

import { assertCapacityTx } from "@/services/booking/create";

const tx = { booking: { findMany: mockFindMany } } as never;

beforeEach(() => {
  vi.clearAllMocks();
  mockFindMany.mockResolvedValue([]);
});

/**
 * Kapasite = dükkana kaç valiz SIĞDIĞI. Fiziksel bir gerçek.
 *
 * 2026-09-01'de ölçüldü: çıkış saati geçmiş ama hâlâ `CHECKED_IN` olan
 * rezervasyonlar — yani rafta duran ama teslim alınmamış valizler — örtüşme
 * koşulunu sağlamadığı için kapasiteden DÜŞÜLMÜYORDU.
 */
describe("kapasite sorgusu: rafta duran valizler", () => {
  it("çıkış saati GEÇMİŞ `CHECKED_IN` rezervasyonları da sorguya dahil eder", async () => {
    /*
      Asil kusur buydu. Sorgu `checkOutTime > yeniCheckIn` istiyordu; cikis
      saati gecmis bir valiz bunu saglamaz ve gorunmez olurdu. Artik `OR`in
      ikinci dali onu yakaliyor.
    */
    await assertCapacityTx(tx, { capacity: 10 }, "s1", new Date(), new Date(Date.now() + 3600e3), 1);

    const where = mockFindMany.mock.calls[0][0].where;
    const overlapClause = where.AND[0];
    expect(overlapClause.OR).toHaveLength(2);
    expect(overlapClause.OR[1]).toEqual({
      AND: [{ status: "CHECKED_IN" }, { checkOutTime: { lte: expect.any(Date) } }],
    });
  });

  it("rafta duran valizler kalan kapasiteyi DÜŞÜRÜR", async () => {
    // Gelistirme veritabaninda olculdu: sayilan 23 + gorunmeyen 3 = 26.
    // Kapasite 50 ise kalan 24 olmali, 27 degil.
    mockFindMany.mockResolvedValue([
      { bagCountS: 23, bagCountM: 0, bagCountXl: 0 },
      { bagCountS: 3, bagCountM: 0, bagCountXl: 0 },
    ]);

    await expect(
      assertCapacityTx(tx, { capacity: 50 }, "s1", new Date(), new Date(Date.now() + 3600e3), 24),
    ).resolves.toBeUndefined();

    await expect(
      assertCapacityTx(tx, { capacity: 50 }, "s1", new Date(), new Date(Date.now() + 3600e3), 25),
    ).rejects.toThrow(/kapasite/i);
  });

  it("boy fark etmeksizin VALİZ sayılır", async () => {
    // Kapasite rezervasyon degil VALIZ cinsinden; tek rezervasyon 5 valiz tasiyabilir.
    mockFindMany.mockResolvedValue([{ bagCountS: 2, bagCountM: 2, bagCountXl: 1 }]);
    await expect(
      assertCapacityTx(tx, { capacity: 5 }, "s1", new Date(), new Date(Date.now() + 3600e3), 1),
    ).rejects.toThrow(/kapasite/i);
  });

  it("düzenlenen rezervasyonun KENDİSİ hesaba katılmaz", async () => {
    // Aksi halde 2 valizi 3'e cikarmak, kendi 2 valizini de sayarak reddedilirdi.
    await assertCapacityTx(
      tx, { capacity: 10 }, "s1", new Date(), new Date(Date.now() + 3600e3), 3, "b-duzenlenen",
    );
    expect(mockFindMany.mock.calls[0][0].where.id).toEqual({ not: "b-duzenlenen" });
  });
});
