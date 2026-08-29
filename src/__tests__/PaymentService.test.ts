/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { PaymentService, toMinor, fromMinor } from "../services/PaymentService";
import { ManualPaymentProvider } from "@/lib/payments";

const { mockPrisma, mockRecord } = vi.hoisted(() => {
  const tx = {
    paymentLog: { update: vi.fn() },
    booking: { update: vi.fn() },
    paymentSplit: { upsert: vi.fn(), update: vi.fn() },
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
      paymentSplit: { findUnique: vi.fn(), update: vi.fn(), upsert: vi.fn() },
      $transaction: vi.fn(async (fn: (t: typeof tx) => Promise<any>) => fn(tx)),
      __tx: tx,
    },
  };
});

vi.mock("@/lib/db", () => ({ default: mockPrisma }));
vi.mock("@/services/BookingEventService", () => ({
  bookingEventService: { record: mockRecord },
}));
// Komisyon orani artik merkezi kurallardan geliyor; testte sabitleniyor ki
// ayarin degismesi bu testleri kirmasin.
vi.mock("@/lib/platform-settings", () => ({
  getPricingRules: vi.fn().mockResolvedValue({ platformCommissionRate: 0.2 }),
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
    mockPrisma.booking.findUnique.mockResolvedValue({ shopId: "s1" });
    mockPrisma.paymentSplit.findUnique.mockResolvedValue(null);
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
    // Iade artik tahsilat gibi TEK transaction icinde: paylasim satiri da ayni
    // anda duzeltiliyor, o yuzden assert tx mock'una bakiyor.
    const data = mockPrisma.__tx.paymentLog.update.mock.calls[0][0].data;
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
    const data = mockPrisma.__tx.paymentLog.update.mock.calls[0][0].data;
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

describe("PaymentService — paylaşım (split)", () => {
  const service = new PaymentService(new ManualPaymentProvider());

  beforeEach(() => {
    vi.clearAllMocks();
    mockPrisma.booking.findUnique.mockResolvedValue({ shopId: "s1" });
    mockPrisma.paymentSplit.findUnique.mockResolvedValue(null);
  });

  it("tahsilatla AYNI transaction'da paylaşımı yazar", async () => {
    // Ayri yazilsaydi araya giren bir hata "tahsil edilmis ama paylasimi
    // olmayan" bir odeme birakirdi -- bu servisin var olma sebebi olan
    // hatanin aynisi, bir katman asagida.
    mockPrisma.paymentLog.findUnique.mockResolvedValue({
      id: "p1", bookingId: "b1", status: "PENDING", amount: 100,
      refundedAmount: 0, currency: "TRY", providerRef: null, transactionId: null,
    });

    const res = await service.markCaptured({ bookingId: "b1" });
    expect(res.ok).toBe(true);

    expect(mockPrisma.__tx.paymentSplit.upsert).toHaveBeenCalledTimes(1);
    const arg = mockPrisma.__tx.paymentSplit.upsert.mock.calls[0][0];
    expect(arg.where).toEqual({ paymentLogId: "p1" });
    expect(arg.create).toMatchObject({
      shopId: "s1",
      grossAmount: 100,
      commissionRate: 0.2,
      platformCommission: 20,
      merchantAmount: 80,
      status: "PENDING",
    });
  });

  it("kullanılan oranı KAYDA yazar — sonradan ayar değişse de geçmiş sabit kalır", async () => {
    mockPrisma.paymentLog.findUnique.mockResolvedValue({
      id: "p1", bookingId: "b1", status: "PENDING", amount: 250,
      refundedAmount: 0, currency: "TRY", providerRef: null, transactionId: null,
    });
    await service.markCaptured({ bookingId: "b1" });
    const create = mockPrisma.__tx.paymentSplit.upsert.mock.calls[0][0].create;
    expect(create.commissionRate).toBe(0.2);
    expect(create.platformCommission + create.merchantAmount).toBe(create.grossAmount);
  });

  it("aynı tahsilat iki kez bildirilirse ikinci paylaşım satırı üretmez", async () => {
    // upsert + paymentLogId @unique: yaris da burada kirilir.
    mockPrisma.paymentLog.findUnique.mockResolvedValue({
      id: "p1", bookingId: "b1", status: "PENDING", amount: 100,
      refundedAmount: 0, currency: "TRY", providerRef: null, transactionId: null,
    });
    await service.markCaptured({ bookingId: "b1" });
    const arg = mockPrisma.__tx.paymentSplit.upsert.mock.calls[0][0];
    expect(arg.update).toEqual({});
  });

  it("tamamı iade edilince paylaşımı REVERSED yapar", async () => {
    // Aksi halde geri verilmis para, esnafin hakedisinde PENDING olarak durur.
    mockPrisma.paymentLog.findUnique.mockResolvedValue({
      id: "p1", bookingId: "b1", status: "SUCCESS", amount: 100,
      refundedAmount: 0, currency: "TRY", providerRef: "r1", transactionId: "t1",
    });
    mockPrisma.paymentSplit.findUnique.mockResolvedValue({
      id: "sp1", commissionRate: 0.2, grossAmount: 100,
    });

    await service.refund({ bookingId: "b1", amount: 100, reason: "iptal" });

    expect(mockPrisma.__tx.paymentSplit.update).toHaveBeenCalledTimes(1);
    expect(mockPrisma.__tx.paymentSplit.update.mock.calls[0][0].data).toEqual({
      status: "REVERSED",
    });
  });

  it("kısmi iadede kalanı KAYDIN KENDİ oranıyla yeniden böler", async () => {
    // Guncel ayari kullanmak, aradan gecen surede oran degistiyse gecmis bir
    // odemeyi bugunku komisyonla yeniden hesaplamak olurdu. Kayitta 0.4 var,
    // guncel ayar 0.2 -- sonuc 0.4'e gore cikmali.
    mockPrisma.paymentLog.findUnique.mockResolvedValue({
      id: "p1", bookingId: "b1", status: "SUCCESS", amount: 100,
      refundedAmount: 0, currency: "TRY", providerRef: "r1", transactionId: "t1",
    });
    mockPrisma.paymentSplit.findUnique.mockResolvedValue({
      id: "sp1", commissionRate: 0.4, grossAmount: 100,
    });

    await service.refund({ bookingId: "b1", amount: 40, reason: "kismi" });

    const data = mockPrisma.__tx.paymentSplit.update.mock.calls[0][0].data;
    expect(data.grossAmount).toBe(60);
    expect(data.merchantAmount).toBe(36);
    expect(data.platformCommission).toBe(24);
    expect(data.merchantAmount + data.platformCommission).toBe(data.grossAmount);
  });
});
