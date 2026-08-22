import { describe, it, expect } from "vitest";
import { parseCheckInSeals } from "@/lib/seal-payload";

/**
 * Mühür gövdesi tek noktadan doğrulanır (web + mobil).
 *
 * NEDEN: mobil uç eskiden istek gövdesini olduğu gibi `BookingService.checkIn`'e
 * geçiriyordu ve sınama yalnızca `if (body?.sealAssignments)` idi — doğruluk
 * sınaması, tip sınaması değil. `BookingSeal.bagSize` düz `String` olduğundan
 * veritabanı da hiçbir şeyi engellemiyor.
 */
describe("parseCheckInSeals", () => {
  it("mühürsüz check-in meşrudur — undefined kabul edilir", () => {
    expect(parseCheckInSeals(undefined)).toEqual({ ok: true, value: undefined });
    expect(parseCheckInSeals(null)).toEqual({ ok: true, value: undefined });
  });

  it("geçerli gövdeyi ayrıştırır ve faultySealNumbers'ı varsayılana çeker", () => {
    const result = parseCheckInSeals({
      sealAssignments: [{ sealNumber: 101, bagIndex: 0, bagSize: "S" }],
    });

    expect(result).toEqual({
      ok: true,
      value: {
        sealAssignments: [{ sealNumber: 101, bagIndex: 0, bagSize: "S" }],
        faultySealNumbers: [],
      },
    });
  });

  /**
   * Eski sınama `"x"` için `.length === 1` görüyordu: bir valizlik rezervasyonda
   * mühür sayısı "eşleşmiş" sayılıyor, sonra harf harf dolaşılıyordu.
   */
  it("dizi olmayan sealAssignments REDDEDİLİR", () => {
    expect(parseCheckInSeals({ sealAssignments: "x" }).ok).toBe(false);
    expect(parseCheckInSeals({ sealAssignments: 3 }).ok).toBe(false);
  });

  it("bagSize serbest metin OLAMAZ", () => {
    const result = parseCheckInSeals({
      sealAssignments: [{ sealNumber: 101, bagIndex: 0, bagSize: "XXL" }],
    });
    expect(result.ok).toBe(false);
  });

  it("negatif bagIndex reddedilir — check-out eşleştirmesini bozar", () => {
    const result = parseCheckInSeals({
      sealAssignments: [{ sealNumber: 101, bagIndex: -1, bagSize: "S" }],
    });
    expect(result.ok).toBe(false);
  });

  it("ondalıklı veya sıfır seri numarası reddedilir", () => {
    expect(
      parseCheckInSeals({
        sealAssignments: [{ sealNumber: 10.5, bagIndex: 0, bagSize: "S" }],
      }).ok,
    ).toBe(false);
    expect(
      parseCheckInSeals({
        sealAssignments: [{ sealNumber: 0, bagIndex: 0, bagSize: "S" }],
      }).ok,
    ).toBe(false);
  });

  it("sınırsız dizi kabul edilmez", () => {
    const huge = Array.from({ length: 501 }, (_, i) => ({
      sealNumber: i + 1,
      bagIndex: i,
      bagSize: "S" as const,
    }));
    expect(parseCheckInSeals({ sealAssignments: huge }).ok).toBe(false);
  });

  it("faultySealNumbers tamsayı dizisi olmak zorunda", () => {
    expect(
      parseCheckInSeals({ sealAssignments: [], faultySealNumbers: ["101"] }).ok,
    ).toBe(false);
  });
});
