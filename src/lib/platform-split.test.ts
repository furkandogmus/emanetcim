import { describe, it, expect } from "vitest";
import {
  EARNING_BOOKING_STATUSES,
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
  it("0 ile 1 arasında bir oran döner", () => {
    const r = getMerchantShareRatio();
    expect(r).toBeGreaterThanOrEqual(0);
    expect(r).toBeLessThanOrEqual(1);
  });
});
