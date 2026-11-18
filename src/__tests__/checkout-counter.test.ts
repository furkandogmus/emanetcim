import { describe, it, expect, vi } from "vitest";

vi.mock("@/lib/db", () => ({ default: {} }));
vi.mock("@/lib/platform-settings", async () => {
  const { DEFAULT_PRICING_RULES } = await import("@/lib/pricing-rules");
  return { getPricingRules: vi.fn(async () => ({ ...DEFAULT_PRICING_RULES, latePickupFeeTry: 50, latePickupGraceMin: 15 })) };
});

import { sealService } from "@/services/SealService";
import { previewCheckOutCharges } from "@/services/booking/check-out";

function txWith(sealNumbers: number[]) {
  const updateMany = vi.fn(async () => ({ count: 1 }));
  const tx = {
    bookingSeal: { findMany: vi.fn(async () => sealNumbers.map((sealNumber) => ({ sealNumber }))) },
    seal: { updateMany },
  };
  return { tx, updateMany };
}

describe("teslimde bozuk muhur", () => {
  it("saglam muhurler RETURNED, bozuklar FAULTY olur", async () => {
    const { tx, updateMany } = txWith([101, 102, 103]);
    await sealService.applyCheckOutReturnSealsWithinTx(tx as never, "b1", [102]);
    expect(updateMany).toHaveBeenCalledWith({ where: { serialNumber: { in: [101, 103] } }, data: { status: "RETURNED" } });
    expect(updateMany).toHaveBeenCalledWith({ where: { serialNumber: { in: [102] } }, data: { status: "FAULTY" } });
  });

  it("rezervasyona ait olmayan muhur reddedilir", async () => {
    const { tx } = txWith([101]);
    await expect(sealService.applyCheckOutReturnSealsWithinTx(tx as never, "b1", [999])).rejects.toThrow(
      "broken_seal_not_on_booking",
    );
  });
});

describe("teslim oncesi ucret onizlemesi", () => {
  const booking = {
    checkInTime: new Date("2026-11-20T10:00:00Z"),
    checkOutTime: new Date("2026-11-20T14:00:00Z"),
    unitPrice: 100,
    bagCountS: 0,
    bagCountM: 1,
    bagCountXl: 0,
    totalPrice: 100,
    insuranceFee: 0,
  };

  it("tolerans icinde gecikme ucreti yok", async () => {
    const r = await previewCheckOutCharges(booking, new Date("2026-11-20T14:10:00Z"));
    expect(r.lateFeeTry).toBe(0);
  });

  it("tolerans asilinca ayardaki gecikme ucreti", async () => {
    const r = await previewCheckOutCharges(booking, new Date("2026-11-20T15:00:00Z"));
    expect(r.lateFeeTry).toBe(50);
  });
});
