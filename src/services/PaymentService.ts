import type { PaymentStatus, Role } from "@prisma/client";
import prisma from "@/lib/db";
import logger from "@/lib/logger";
import { moneyToNumber } from "@/lib/money";
import { computeSplit } from "@/lib/platform-split";
import { getPricingRules } from "@/lib/platform-settings";
import { bookingEventService } from "./BookingEventService";
import { getPaymentProvider, type PaymentProvider } from "@/lib/payments";
import { featureFlagService } from "./FeatureFlagService";

/**
 * Ödeme defterinin TEK yazıcısı.
 *
 * NEDEN TEK KAPI: 2026-08-22 denetiminde para durumu üç ayrı yerden, üç ayrı
 * kuralla değişiyordu — `BookingService.markAsPaid` rezervasyonu `PAID` yapıp
 * hiç defter satırı yazmıyordu (prod'da 7 ödemesiz "ödenmiş" rezervasyon),
 * iptal akışı ham `updateMany` ile `REFUNDED` yazıyordu, ve `PaymentLog`
 * varsayılanı `SUCCESS` olduğu için script'ten atılan her satır "tahsil edildi"
 * anlamına geliyordu (karşılığı olmayan 3.480 TRY).
 *
 * Buradaki her metot iki şeyi birlikte yapar: defteri günceller ve
 * `BookingEvent`'e denetim izi bırakır. Ham `prisma.paymentLog.*` yazımı
 * yapmayın.
 *
 * PARA BİRİMİ: dışarıya `number` (TRY) veriliyor çünkü şema `Decimal(12,2)`
 * kullanıyor; sağlayıcıya giderken kuruşa (`Minor`) çevriliyor, çünkü PSP'lerin
 * tamamı tamsayı kuruş bekler ve float yuvarlama hatası orada para kaybettirir.
 */

export type PaymentActor = {
  id?: string | null;
  role?: Role | null;
};

export type LedgerResult<T = void> =
  | { ok: true; value: T }
  | { ok: false; code: string; message: string };

/** TRY -> kuruş. 120.505 gibi bir girdiyi de doğru yuvarlar. */
export function toMinor(amount: number): number {
  return Math.round(amount * 100);
}

/** Kuruş -> TRY. */
export function fromMinor(minor: number): number {
  return Math.round(minor) / 100;
}

/**
 * Hangi durumdan hangisine geçilebilir. Geçiş tablosunu koda gömmek yerine
 * burada tutuyoruz ki "SUCCESS iken tekrar SUCCESS yazma" gibi sessiz hatalar
 * test edilebilir bir kuralla engellensin.
 */
const ALLOWED_TRANSITIONS: Record<PaymentStatus, PaymentStatus[]> = {
  PENDING: ["AUTHORIZED", "SUCCESS", "FAILED", "CANCELLED"],
  AUTHORIZED: ["SUCCESS", "FAILED", "CANCELLED"],
  SUCCESS: ["REFUNDED", "PARTIALLY_REFUNDED"],
  PARTIALLY_REFUNDED: ["REFUNDED", "PARTIALLY_REFUNDED"],
  FAILED: ["PENDING"],
  REFUNDED: [],
  CANCELLED: [],
};

/**
 * Ödeme alımını kapatan özellik bayrağının anahtarı. Admin ekranında bu adla
 * görünür; satır yoksa ödeme AÇIK sayılır (bkz. `isAcceptingNewPayments`).
 */
export const PAYMENTS_FLAG_KEY = "payments";

function canTransition(from: PaymentStatus, to: PaymentStatus): boolean {
  return ALLOWED_TRANSITIONS[from]?.includes(to) ?? false;
}

export class PaymentService {
  constructor(private readonly provider: PaymentProvider = getPaymentProvider()) {}

  /** Aktif sağlayıcının yetenekleri. UI ve kamuya açık metinler bunu okumalı. */
  get capabilities() {
    return this.provider.capabilities;
  }

  /**
   * Yeni ödeme yükümlülüğü açılabilir mi? İki kaynak, ortam KAZANIR.
   *
   * 1. `PAYMENTS_ENABLED=false` (ortam) → kapalı, veritabanına hiç bakılmaz.
   * 2. `payments` özellik bayrağı (veritabanı) → yoksa AÇIK sayılır.
   *
   * SIRA VE VARSAYILANLAR BİLEREK BÖYLE:
   *
   * - **Ortam önce ve DB'ye bakmadan.** Acil durum düğmesinin çalışması,
   *   veritabanının sağlıklı olmasına bağlı olmamalı — kapatma ihtiyacı doğuran
   *   olay tam da veritabanını yavaşlatan olay olabilir. Admin ekranı da altı
   *   dilde "bu ekrandan bağımsız" diyor; sözleşme bu.
   * - **Bayrak yoksa AÇIK.** `featureFlagService.isEnabled` tanımsız bayrağı
   *   `false` sayar (yeni özellikler için doğru varsayılan), ama burada tersi
   *   gerekir: bugün `payments` satırı olmayan bir kurulumda ödeme almak
   *   ÇALIŞIYOR. Bayrağın yokluğu "ödemeyi kapat" demek olsaydı, bu değişikliğin
   *   kendisi canlıda ödemeyi durdururdu.
   *
   * KAPSAM: yalnızca YENİ yükümlülük açmayı yönetir (misafir checkout'u).
   * Check-in tahsilatı ve iade bilerek dışarıda — gerekçe
   * `src/services/booking/errors.ts` → `BookingPaymentsDisabledError`.
   */
  async isAcceptingNewPayments(): Promise<boolean> {
    if (process.env.PAYMENTS_ENABLED?.trim() === "false") {
      return false;
    }

    return featureFlagService.isEnabled(
      PAYMENTS_FLAG_KEY,
      {},
      { defaultWhenMissing: true },
    );
  }

  /**
   * Rezervasyon için ödeme niyeti açar (idempotent).
   *
   * Aynı `bookingId` için ikinci çağrı yeni satır YARATMAZ, mevcut satırı döner.
   * Böylece "kullanıcı ödeme sayfasını iki kez açtı" senaryosu iki defter satırı
   * üretmez.
   */
  async openIntent(params: {
    bookingId: string;
    amount: number;
    currency?: string;
    actor?: PaymentActor;
  }): Promise<LedgerResult<{ redirectUrl: string | null; status: PaymentStatus }>> {
    const currency = params.currency ?? "TRY";
    if (!(params.amount > 0)) {
      return { ok: false, code: "INVALID_AMOUNT", message: "Tutar sıfırdan büyük olmalı." };
    }

    const existing = await prisma.paymentLog.findUnique({
      where: { bookingId: params.bookingId },
    });
    if (existing) {
      return {
        ok: true,
        value: { redirectUrl: null, status: existing.status },
      };
    }

    const idempotencyKey = `intent:${params.bookingId}`;
    const intent = await this.provider.createIntent({
      bookingId: params.bookingId,
      amountMinor: toMinor(params.amount),
      currency,
      idempotencyKey,
    });

    const status: PaymentStatus = intent.capturedImmediately ? "SUCCESS" : "PENDING";
    await prisma.paymentLog.create({
      data: {
        bookingId: params.bookingId,
        amount: params.amount,
        currency,
        provider: this.provider.capabilities.id,
        providerRef: intent.providerRef,
        idempotencyKey,
        status,
        capturedAt: intent.capturedImmediately ? new Date() : null,
      },
    });

    await this.audit(params.bookingId, "CREATED", params.actor, {
      payment: "intent_opened",
      provider: this.provider.capabilities.id,
      amount: params.amount,
      currency,
    });

    return { ok: true, value: { redirectUrl: intent.redirectUrl, status } };
  }

  /**
   * Parayı tahsil edilmiş olarak işaretler ve rezervasyonu `PAID` yapar.
   *
   * İkisi TEK transaction içinde: eskiden rezervasyon `PAID` olup defter boş
   * kalabiliyordu, bu ayrımın kendisi hataydı.
   */
  async markCaptured(params: {
    bookingId: string;
    actor?: PaymentActor;
    /** Sağlayıcı dışı bir tahsilatın (havale vb.) referansı. */
    externalReference?: string | null;
  }): Promise<LedgerResult<{ transactionId: string | null }>> {
    const log = await prisma.paymentLog.findUnique({
      where: { bookingId: params.bookingId },
    });
    if (!log) {
      return {
        ok: false,
        code: "NO_INTENT",
        message: "Bu rezervasyon için açılmış bir ödeme kaydı yok.",
      };
    }
    if (log.status === "SUCCESS") {
      // Idempotent: aynı tahsilatın iki kez bildirilmesi hata değil.
      return { ok: true, value: { transactionId: log.transactionId } };
    }
    if (!canTransition(log.status, "SUCCESS")) {
      return {
        ok: false,
        code: "INVALID_TRANSITION",
        message: `Ödeme durumu ${log.status} iken tahsilat işaretlenemez.`,
      };
    }

    const captured = await this.provider.capture({
      bookingId: params.bookingId,
      providerRef: log.providerRef,
      amountMinor: toMinor(moneyToNumber(log.amount)),
      currency: log.currency,
    });
    const transactionId = params.externalReference ?? captured.transactionId;

    // Paylaşım, tahsilatla AYNI işlemde yazılır. Ayrı yazılsaydı araya giren bir
    // hata "tahsil edilmiş ama paylaşımı olmayan" bir ödeme bırakırdı -- bu
    // servisin var olma sebebi olan hatanın (karşılığı olmayan para kaydı) tam
    // olarak aynısı, yalnızca bir katman aşağıda.
    const booking = await prisma.booking.findUnique({
      where: { id: params.bookingId },
      select: { shopId: true },
    });
    const rules = await getPricingRules();
    const gross = moneyToNumber(log.amount);
    const split = computeSplit(gross, rules.platformCommissionRate);

    await prisma.$transaction(async (tx) => {
      await tx.paymentLog.update({
        where: { id: log.id },
        data: {
          status: "SUCCESS",
          transactionId,
          providerRef: captured.providerRef,
          capturedAt: new Date(),
          failureReason: null,
        },
      });
      await tx.booking.update({
        where: { id: params.bookingId },
        data: { status: "PAID" },
      });
      if (booking) {
        // upsert: aynı tahsilatın iki kez bildirilmesi ikinci bir paylaşım
        // satırı üretmemeli. paymentLogId @unique olduğu için yarış da burada
        // kırılır, sessizce çiftlenmez.
        await tx.paymentSplit.upsert({
          where: { paymentLogId: log.id },
          create: {
            paymentLogId: log.id,
            shopId: booking.shopId,
            grossAmount: split.grossAmount,
            commissionRate: split.commissionRate,
            platformCommission: split.platformCommission,
            merchantAmount: split.merchantAmount,
            currency: log.currency,
            status: "PENDING",
          },
          update: {},
        });
      }
    });

    await this.audit(params.bookingId, "PAID", params.actor, {
      provider: this.provider.capabilities.id,
      transactionId,
      amount: moneyToNumber(log.amount),
    });

    return { ok: true, value: { transactionId } };
  }

  /** Tahsilat başarısız. Rezervasyon durumu DEĞİŞMEZ — ödenmemiş sayılır. */
  async markFailed(params: {
    bookingId: string;
    reason: string;
    actor?: PaymentActor;
  }): Promise<LedgerResult> {
    const log = await prisma.paymentLog.findUnique({
      where: { bookingId: params.bookingId },
    });
    if (!log) {
      return { ok: false, code: "NO_INTENT", message: "Ödeme kaydı yok." };
    }
    if (!canTransition(log.status, "FAILED")) {
      return {
        ok: false,
        code: "INVALID_TRANSITION",
        message: `Ödeme durumu ${log.status} iken başarısız işaretlenemez.`,
      };
    }
    await prisma.paymentLog.update({
      where: { id: log.id },
      data: { status: "FAILED", failureReason: params.reason.slice(0, 500) },
    });
    await this.audit(params.bookingId, "MODIFIED", params.actor, {
      payment: "failed",
      reason: params.reason,
    });
    return { ok: true, value: undefined };
  }

  /**
   * İade. Tutar verilmezse kalan bakiyenin tamamı iade edilir.
   *
   * Kısmi iade `PARTIALLY_REFUNDED` üretir; toplam iade `amount`'a ulaşınca
   * durum `REFUNDED` olur. Eskiden yalnızca "hepsi REFUNDED" vardı ve kısmi
   * iade defterde görünmüyordu.
   */
  async refund(params: {
    bookingId: string;
    amount?: number;
    reason: string;
    actor?: PaymentActor;
  }): Promise<LedgerResult<{ refundedTotal: number; status: PaymentStatus }>> {
    const log = await prisma.paymentLog.findUnique({
      where: { bookingId: params.bookingId },
    });
    if (!log) {
      return { ok: false, code: "NO_INTENT", message: "Ödeme kaydı yok." };
    }

    const total = moneyToNumber(log.amount);
    const already = moneyToNumber(log.refundedAmount);
    const remaining = Math.round((total - already) * 100) / 100;
    if (remaining <= 0) {
      return { ok: false, code: "NOTHING_TO_REFUND", message: "İade edilecek bakiye yok." };
    }

    const requested = params.amount ?? remaining;
    if (requested <= 0 || requested > remaining) {
      return {
        ok: false,
        code: "INVALID_AMOUNT",
        message: `İade tutarı 0 ile ${remaining} arasında olmalı.`,
      };
    }

    const nextTotal = Math.round((already + requested) * 100) / 100;
    const nextStatus: PaymentStatus =
      nextTotal >= total ? "REFUNDED" : "PARTIALLY_REFUNDED";
    if (!canTransition(log.status, nextStatus)) {
      return {
        ok: false,
        code: "INVALID_TRANSITION",
        message: `Ödeme durumu ${log.status} iken iade edilemez.`,
      };
    }

    const result = await this.provider.refund({
      bookingId: params.bookingId,
      providerRef: log.providerRef,
      amountMinor: toMinor(requested),
      currency: log.currency,
      reason: params.reason,
    });

    // İade, paylaşımı da düzeltmek ZORUNDA. Aksi halde tamamı iade edilmiş bir
    // ödeme, esnafa ödenmeyi bekleyen PENDING bir paylaşım satırı bırakır ve
    // hakediş, geri verilmiş parayı içerir.
    const existingSplit = await prisma.paymentSplit.findUnique({
      where: { paymentLogId: log.id },
    });

    await prisma.$transaction(async (tx) => {
      await tx.paymentLog.update({
        where: { id: log.id },
        data: {
          status: nextStatus,
          refundedAmount: nextTotal,
          refundedAt: new Date(),
          providerRef: result.providerRef ?? log.providerRef,
        },
      });

      if (existingSplit) {
        if (nextStatus === "REFUNDED") {
          // Tamamı iade: paylaşım geri alınır. Tutarlar SİLİNMEZ, tarihsel
          // kayıt olarak durur -- ne kadarın hangi oranla bölünmüş olduğu
          // mutabakatta hâlâ gerekir.
          await tx.paymentSplit.update({
            where: { id: existingSplit.id },
            data: { status: "REVERSED" },
          });
        } else {
          // Kısmi iade: kalan tutar, KAYDIN KENDİ oranıyla yeniden bölünür.
          // Güncel ayarı kullanmak, aradan geçen sürede oran değiştiyse geçmiş
          // bir ödemeyi bugünkü komisyonla yeniden hesaplamak olurdu.
          const remainingGross = Math.round((total - nextTotal) * 100) / 100;
          const rebalanced = computeSplit(
            remainingGross,
            moneyToNumber(existingSplit.commissionRate),
          );
          await tx.paymentSplit.update({
            where: { id: existingSplit.id },
            data: {
              grossAmount: rebalanced.grossAmount,
              platformCommission: rebalanced.platformCommission,
              merchantAmount: rebalanced.merchantAmount,
            },
          });
        }
      }
    });

    await this.audit(params.bookingId, "REFUNDED", params.actor, {
      provider: this.provider.capabilities.id,
      amount: requested,
      refundedTotal: nextTotal,
      /**
       * false ise para HENÜZ misafire ulaşmadı — manuel sağlayıcıda iade
       * fizikseldir. Operasyon panelinin takip etmesi gereken alan budur.
       */
      settled: result.settled,
      reason: params.reason,
    });

    return { ok: true, value: { refundedTotal: nextTotal, status: nextStatus } };
  }

  /** Tahsilat yapılmadan niyeti kapatır (rezervasyon iptali). */
  async cancelIntent(params: {
    bookingId: string;
    actor?: PaymentActor;
  }): Promise<LedgerResult> {
    const log = await prisma.paymentLog.findUnique({
      where: { bookingId: params.bookingId },
    });
    if (!log) return { ok: true, value: undefined };
    if (!canTransition(log.status, "CANCELLED")) {
      return {
        ok: false,
        code: "INVALID_TRANSITION",
        message: `Ödeme durumu ${log.status} iken iptal edilemez.`,
      };
    }
    await prisma.paymentLog.update({
      where: { id: log.id },
      data: { status: "CANCELLED" },
    });
    await this.audit(params.bookingId, "CANCELLED", params.actor, {
      payment: "intent_cancelled",
    });
    return { ok: true, value: undefined };
  }

  /** Tahsil edilmiş para var mı? Hakediş ve iptal akışları bunu sorar. */
  async hasCapturedPayment(bookingId: string): Promise<boolean> {
    const log = await prisma.paymentLog.findFirst({
      where: {
        bookingId,
        status: { in: ["SUCCESS", "PARTIALLY_REFUNDED"] },
      },
      select: { id: true },
    });
    return !!log;
  }

  private async audit(
    bookingId: string,
    event: Parameters<typeof bookingEventService.record>[0]["event"],
    actor: PaymentActor | undefined,
    metadata: Record<string, unknown>,
  ): Promise<void> {
    await bookingEventService
      .record({
        bookingId,
        event,
        actorId: actor?.id ?? null,
        actorRole: actor?.role ?? null,
        metadata,
      })
      .catch((err) =>
        logger.error({ err, bookingId, event }, "payment_audit_failed"),
      );
  }
}

export const paymentService = new PaymentService();
