import { describe, it, expect } from "vitest";
import {
  EARNING_BOOKING_STATUSES,
  clampCommissionRate,
  computeSplit,
  computeSubMerchantShare,
  countsTowardEarnings,
  getMerchantShareRatio,
} from "./platform-split";

describe("hakedişe sayılan rezervasyon durumları", () => {
  it("yalnızca parası alınmış/teslim edilmiş durumları sayar", () => {
    expect(countsTowardEarnings("PAID")).toBe(true);
    expect(countsTowardEarnings("CHECKED_IN")).toBe(true);
    expect(countsTowardEarnings("CHECKED_OUT")).toBe(true);
  });

  it("henüz ödenmemiş durumları saymaz", () => {
    // 2026-08-22 canlı hatası: partner ana paneli bunları da kazanç sayıyordu ve
    // kazanç sayfasından farklı bir net hakediş gösteriyordu (710 TL vs 490 TL).
    expect(countsTowardEarnings("APPROVED")).toBe(false);
    expect(countsTowardEarnings("WAITING_APPROVAL")).toBe(false);
    expect(countsTowardEarnings("PENDING")).toBe(false);
  });

  it("iptal edileni saymaz", () => {
    expect(countsTowardEarnings("CANCELLED")).toBe(false);
  });

  it("bilinmeyen bir durumu varsayılan olarak saymaz (güvenli taraf)", () => {
    expect(countsTowardEarnings("SOME_FUTURE_STATUS")).toBe(false);
  });

  it("ana panel ile kazanç sayfası aynı kümeyi kullanır", () => {
    // Iki sayfa da EARNING_BOOKING_STATUSES'u import ediyor; burada kumenin
    // beklenmedik sekilde genislemedigini sabitliyoruz.
    expect([...EARNING_BOOKING_STATUSES].sort()).toEqual([
      "CHECKED_IN",
      "CHECKED_OUT",
      "PAID",
    ]);
  });
});

describe("esnaf payı oranı", () => {
  it("verilen orana göre tamamlayanı döner", () => {
    expect(getMerchantShareRatio(0.5)).toBeCloseTo(0.5, 10);
    expect(getMerchantShareRatio(0.2)).toBeCloseTo(0.8, 10);
    expect(getMerchantShareRatio(0)).toBe(1);
    expect(getMerchantShareRatio(1)).toBe(0);
  });

  it("aralık dışı oranı kırpar", () => {
    // Oran artik veritabanindan geliyor; elle girilmis bir deger hesabi
    // anlamsiz kilmasin diye kirpiliyor.
    expect(clampCommissionRate(1.4)).toBe(1);
    expect(clampCommissionRate(-0.3)).toBe(0);
  });

  it("sayı olmayan oranda GÜVENLİ yöne, yani 0'a düşer", () => {
    // Yon bilincli: bozuk bir oran esnaftan fazla almamali. 0 demek
    // "platform hicbir sey almaz" demek -- yanlis yapilandirmanin zarari
    // platformda kalir, esnafta degil. Ters yon (1) esnafa hicbir sey
    // birakmazdi ve bunu kimse fark etmezdi.
    expect(clampCommissionRate(Number.NaN)).toBe(0);
    expect(clampCommissionRate(Number.POSITIVE_INFINITY)).toBe(0);
    expect(clampCommissionRate(Number.NEGATIVE_INFINITY)).toBe(0);
  });
});

describe("paylaşım hesabı", () => {
  it("iki parça brütü TAM tutar", () => {
    // Kritik ozellik: iki tarafi ayri ayri yuvarlamak kurus kacirir.
    // Komisyon farktan bulundugu icin toplam her zaman bruttur.
    for (const gross of [100, 120.5, 0.01, 33.33, 99.99, 1234.56, 0.05]) {
      for (const rate of [0, 0.1, 0.15, 0.2, 0.3333, 0.5, 0.75, 1]) {
        const s = computeSplit(gross, rate);
        expect(s.platformCommission + s.merchantAmount).toBeCloseTo(s.grossAmount, 10);
        expect(s.merchantAmount).toBeGreaterThanOrEqual(0);
        expect(s.platformCommission).toBeGreaterThanOrEqual(0);
      }
    }
  });

  it("kuruş hassasiyetinde bölünür", () => {
    const s = computeSplit(100, 0.2);
    expect(s.merchantAmount).toBe(80);
    expect(s.platformCommission).toBe(20);
  });

  it("tek kuruşluk tutarda bile toplamı korur", () => {
    const s = computeSplit(0.01, 0.5);
    expect(s.platformCommission + s.merchantAmount).toBeCloseTo(0.01, 10);
  });

  it("kullanılan oranı kayda geçmek üzere geri döner", () => {
    // Bu deger PaymentSplit.commissionRate'e yazilir: oran sonradan
    // degisince gecmis hakedis degismesin diye enstantane tutuluyor.
    expect(computeSplit(100, 0.42).commissionRate).toBe(0.42);
    expect(computeSplit(100, 5).commissionRate).toBe(1);
  });

  it("computeSubMerchantShare esnaf payını verir", () => {
    expect(computeSubMerchantShare(200, 0.25)).toBe(150);
  });
});
