/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { PaymentService, toMinor, fromMinor } from "../services/PaymentService";
import { ManualPaymentProvider } from "@/lib/payments";

const { mockPrisma, mockRecord } = vi.hoisted(() => {
  const tx = {
    paymentLog: { update: vi.fn() },
    booking: { update: vi.fn() },
  };
  return {
    mockRecord: vi.fn().mockResolvedValue(undefined),
    mockPrisma: {
      paymentLog: {
        findUnique: vi.fn(),
        findFirst: vi.fn(),
        create: vi.fn(),
        update: vi.fn(),
      },
      booking: { findUnique: vi.fn(), update: vi.fn() },
      $transaction: vi.fn(async (fn: (t: typeof tx) => Promise<any>) => fn(tx)),
      __tx: tx,
    },
  };
});

vi.mock("@/lib/db", () => ({ default: mockPrisma }));
vi.mock("@/services/BookingEventService", () => ({
  bookingEventService: { record: mockRecord },
}));

describe("PaymentService — para birimi dönüşümü", () => {
  it("TRY'yi kuruşa yuvarlayarak çevirir (float hatası yapmaz)", () => {
    expect(toMinor(120.5)).toBe(12050);
    expect(toMinor(0.1 + 0.2)).toBe(30);
    expect(toMinor(19.999)).toBe(2000);
    expect(fromMinor(12050)).toBe(120.5);
  });
});

describe("PaymentService — defter", () => {
  const service = new PaymentService(new ManualPaymentProvider());

  beforeEach(() => {
    vi.clearAllMocks();
    mockPrisma.paymentLog.findUnique.mockResolvedValue(null);
    mockPrisma.paymentLog.create.mockResolvedValue({ id: "p1" });
    mockPrisma.paymentLog.update.mockResolvedValue({ id: "p1" });
  });

  it("niyet PENDING olarak açılır — manuel sağlayıcı asla anında SUCCESS yazmaz", async () => {
    const res = await service.openIntent({ bookingId: "b1", amount: 250 });

    expect(res.ok).toBe(true);
    const data = mockPrisma.paymentLog.create.mock.calls[0][0].data;
    expect(data.status).toBe("PENDING");
    expect(data.provider).toBe("manual");
    expect(data.currency).toBe("TRY");
    expect(data.capturedAt).toBeNull();
  });

  it("aynı rezervasyon için ikinci niyet yeni satır yaratmaz (idempotent)", async () => {
    mockPrisma.paymentLog.findUnique.mockResolvedValue({
      id: "p1",
      status: "PENDING",
    });

    const res = await service.openIntent({ bookingId: "b1", amount: 250 });

    expect(res.ok).toBe(true);
    expect(mockPrisma.paymentLog.create).not.toHaveBeenCalled();
  });

  it("sıfır veya negatif tutarda niyet açılmaz", async () => {
    const res = await service.openIntent({ bookingId: "b1", amount: 0 });
    expect(res).toMatchObject({ ok: false, code: "INVALID_AMOUNT" });
  });

  it("defter satırı yokken tahsilat işaretlenemez — 'ödemesiz PAID' bu yüzden imkânsız", async () => {
    mockPrisma.paymentLog.findUnique.mockResolvedValue(null);

    const res = await service.markCaptured({ bookingId: "b1" });

    expect(res).toMatchObject({ ok: false, code: "NO_INTENT" });
    expect(mockPrisma.__tx.booking.update).not.toHaveBeenCalled();
  });

  it("tahsilat, defteri ve rezervasyonu TEK transaction'da günceller", async () => {
    mockPrisma.paymentLog.findUnique.mockResolvedValue({
      id: "p1",
      status: "PENDING",
      amount: 250,
      currency: "TRY",
      providerRef: "manual_b1",
      transactionId: null,
    });

    const res = await service.markCaptured({ bookingId: "b1" });

    expect(res.ok).toBe(true);
    expect(mockPrisma.$transaction).toHaveBeenCalledTimes(1);
    expect(mockPrisma.__tx.paymentLog.update.mock.calls[0][0].data.status).toBe("SUCCESS");
    expect(mockPrisma.__tx.booking.update.mock.calls[0][0].data.status).toBe("PAID");
  });

  it("iade edilmiş bir ödeme tekrar tahsil edilmiş yapılamaz", async () => {
    mockPrisma.paymentLog.findUnique.mockResolvedValue({
      id: "p1",
      status: "REFUNDED",
      amount: 250,
      currency: "TRY",
      providerRef: null,
      transactionId: null,
    });

    const res = await service.markCaptured({ bookingId: "b1" });

    expect(res).toMatchObject({ ok: false, code: "INVALID_TRANSITION" });
  });

  it("kısmi iade PARTIALLY_REFUNDED üretir ve refundedAmount'u biriktirir", async () => {
    mockPrisma.paymentLog.findUnique.mockResolvedValue({
      id: "p1",
      status: "SUCCESS",
      amount: 250,
      refundedAmount: 50,
      currency: "TRY",
      providerRef: null,
    });

    const res = await service.refund({ bookingId: "b1", amount: 100, reason: "test" });

    expect(res).toMatchObject({ ok: true });
    const data = mockPrisma.paymentLog.update.mock.calls[0][0].data;
    expect(data.status).toBe("PARTIALLY_REFUNDED");
    expect(data.refundedAmount).toBe(150);
  });

  it("kalan bakiyenin tamamı iade edilince REFUNDED olur", async () => {
    mockPrisma.paymentLog.findUnique.mockResolvedValue({
      id: "p1",
      status: "PARTIALLY_REFUNDED",
      amount: 250,
      refundedAmount: 150,
      currency: "TRY",
      providerRef: null,
    });

    const res = await service.refund({ bookingId: "b1", reason: "test" });

    expect(res).toMatchObject({ ok: true });
    const data = mockPrisma.paymentLog.update.mock.calls[0][0].data;
    expect(data.status).toBe("REFUNDED");
    expect(data.refundedAmount).toBe(250);
  });

  it("bakiyeden fazla iade reddedilir", async () => {
    mockPrisma.paymentLog.findUnique.mockResolvedValue({
      id: "p1",
      status: "SUCCESS",
      amount: 250,
      refundedAmount: 200,
      currency: "TRY",
      providerRef: null,
    });

    const res = await service.refund({ bookingId: "b1", amount: 100, reason: "test" });

    expect(res).toMatchObject({ ok: false, code: "INVALID_AMOUNT" });
    expect(mockPrisma.paymentLog.update).not.toHaveBeenCalled();
  });

  it("iade denetim izine 'settled: false' yazar — manuel iade henüz misafire ulaşmadı", async () => {
    mockPrisma.paymentLog.findUnique.mockResolvedValue({
      id: "p1",
      status: "SUCCESS",
      amount: 250,
      refundedAmount: 0,
      currency: "TRY",
      providerRef: null,
    });

    await service.refund({ bookingId: "b1", reason: "booking_cancelled" });

    const audit = mockRecord.mock.calls.at(-1)?.[0];
    expect(audit.event).toBe("REFUNDED");
    expect(audit.metadata.settled).toBe(false);
  });

  it("PENDING niyet tahsilat olmadan iptal edilebilir", async () => {
    mockPrisma.paymentLog.findUnique.mockResolvedValue({ id: "p1", status: "PENDING" });

    const res = await service.cancelIntent({ bookingId: "b1" });

    expect(res.ok).toBe(true);
    expect(mockPrisma.paymentLog.update.mock.calls[0][0].data.status).toBe("CANCELLED");
  });

  it("tahsil edilmiş bir ödeme 'iptal' ile silinemez — iade gerekir", async () => {
    mockPrisma.paymentLog.findUnique.mockResolvedValue({ id: "p1", status: "SUCCESS" });

    const res = await service.cancelIntent({ bookingId: "b1" });

    expect(res).toMatchObject({ ok: false, code: "INVALID_TRANSITION" });
  });
});

describe("ManualPaymentProvider — yetenekler", () => {
  it("online tahsilat ve karta iade yapamadığını bildirir", () => {
    const caps = new ManualPaymentProvider().capabilities;
    expect(caps.id).toBe("manual");
    expect(caps.capturesOnline).toBe(false);
    expect(caps.supportsCardRefund).toBe(false);
  });
});
