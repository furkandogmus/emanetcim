import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * Yonetici zorla teslimi (`checkOut(..., { forced })`) teslim anini
 * yansitmaz: gecikme ucreti de erken teslim iadesi de YAZILMAZ. Normal teslim
 * ayni girdilerle ikisini de yazar (kontrol grubu).
 */

const m = vi.hoisted(() => ({
  updateMany: vi.fn(),
  record: vi.fn(),
}));

vi.mock("@/lib/db", () => {
  const tx = { booking: { updateMany: m.updateMany } };
  return {
    default: {
      booking: {
        findUnique: vi.fn(async () => ({
          id: "b1",
          status: "CHECKED_IN",
          bookingRowVersion: 3,
          // Cok gecmis: gecikme ucreti dogar.
          checkOutTime: new Date("2020-01-01T18:00:00Z"),
        })),
      },
      $transaction: async (f: (t: unknown) => unknown) => f(tx),
    },
  };
});
vi.mock("@/lib/logger", () => ({ default: { error: vi.fn(), warn: vi.fn(), info: vi.fn() } }));
vi.mock("@/lib/platform-settings", () => ({
  getPricingRules: vi.fn(async () => ({ latePickupGraceMin: 15, latePickupFeeTry: 80 })),
}));
// Erken teslim iadesi her durumda 30 doner: alan yazilip yazilmadigi olculur.
vi.mock("@/services/PricingService", () => ({ pricingService: { calculateEarlyRefund: () => 30 } }));
vi.mock("@/services/SealService", () => ({ sealService: { applyCheckOutReturnSealsWithinTx: vi.fn() } }));
vi.mock("@/services/BookingEventService", () => ({ bookingEventService: { record: m.record } }));

import { checkOut } from "@/services/booking/check-out";

beforeEach(() => {
  vi.clearAllMocks();
  m.updateMany.mockResolvedValue({ count: 1 });
  m.record.mockResolvedValue(undefined);
});

describe("zorla teslim ucret ve iade yazmaz", () => {
  it("normal teslim: gecikme ucreti ve erken iade yazilir (kontrol)", async () => {
    const r = await checkOut("b1");
    expect(r).toMatchObject({ ok: true, lateFee: 80, refundPending: true, refundAmount: 30 });
    const { data } = m.updateMany.mock.calls[0][0];
    expect(Number(data.lateFeeApplied)).toBe(80);
    expect(Number(data.failedRefundAmount)).toBe(30);
  });

  it("zorla teslim: gecikme ucreti 0, erken iade alani yazilmaz, olay forced + aciklama tasir", async () => {
    const r = await checkOut("b1", { forced: { note: "misafir dukkana geldi" } });
    expect(r).toEqual({ ok: true });
    const { data } = m.updateMany.mock.calls[0][0];
    expect(Number(data.lateFeeApplied)).toBe(0);
    expect(data).not.toHaveProperty("failedRefundAmount");
    expect(data.status).toBe("CHECKED_OUT");
    expect(m.record).toHaveBeenCalledWith(
      expect.objectContaining({
        event: "CHECKED_OUT",
        metadata: expect.objectContaining({ forced: true, note: "misafir dukkana geldi", lateFeeApplied: 0, refundAmount: undefined }),
      }),
    );
  });
});
