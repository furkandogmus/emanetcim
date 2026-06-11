import { iyzipay, assertIyzicoKeys } from "@/lib/iyzipay";
import Iyzipay from 'iyzipay';
import { Prisma } from '@prisma/client';
import prisma from '@/lib/db';
import { isPaymentSuccess } from '@/lib/payment-status';
import { moneyToNumber } from '@/lib/money';
import logger from '@/lib/logger';
import { withTimeout } from '@/lib/async-timeout';
import { isPaymentsEnabled } from '@/lib/feature-flags';
import { getPaymentGateway, isStripePaymentIntentId } from '@/lib/payment-gateway';
import { tryAmountToStripeMinorUnits } from '@/lib/currency';
import { assertStripeKeys, getStripe } from '@/lib/stripe';
import { recordMetric } from '@/lib/metrics';
import { computeSubMerchantShare } from '@/lib/platform-split';
import { notificationService } from '@/services/NotificationService';
import { bookingEventService } from '@/services/BookingEventService';

const IYZICO_OP_TIMEOUT_MS = Number(process.env.IYZICO_HTTP_TIMEOUT_MS) || 45_000;

export interface PaymentCardInput {
  cardHolderName: string;
  cardNumber: string;
  expireMonth: string;
  expireYear: string;
  cvc: string;
}

export interface PaymentBuyerInput {
  id: string;
  name: string;
  phone?: string;
  email: string;
}

export type MarketplacePaymentInput = {
  bookingId: string;
  totalPrice: number;
  subMerchantKey: string;
  subMerchantPrice: number;
  card: PaymentCardInput;
  buyer: PaymentBuyerInput;
  ip: string;
  shopLocation?: {
    city: string;
    address: string;
  };
};

/** iyzico SDK / dahili mock yanıtı */
export type PaymentSdkResult = Record<string, unknown>;

export interface IPaymentService {
  initializeMarketplacePayment(data: MarketplacePaymentInput): Promise<PaymentSdkResult>;
  refundPayment(
    bookingId: string,
    amount: number,
    options?: { keepPaymentLogSuccess?: boolean }
  ): Promise<PaymentSdkResult>;
  /** Ödeme logu SUCCESS iken booking hâlâ PENDING kalan tutarsızlıkları düzeltir (webhook gecikmesi vb.). */
  reconcileStalePaymentBookings(): Promise<{ fixed: number; bookingIds: string[] }>;
  updateSubMerchant(data: {
    subMerchantKey: string;
    name: string;
    address: string;
    email: string;
    phone: string;
  }): Promise<PaymentSdkResult>;
}

/**
 * PaymentService - iyzico Marketplace (Split Payment) Entegrasyonu
 * SOLID: Single Responsibility
 * Paranın esnaf ve platform arasında bölünmesini yönetir.
 */
export class PaymentService implements IPaymentService {
  /** PostgreSQL: aynı booking için ödeme init sıralaması (çifte iyzico çağrısı önleme). */
  private async acquirePaymentLock(bookingId: string): Promise<void> {
    await prisma.$executeRawUnsafe(
      `SELECT pg_advisory_lock(hashtext($1::text)::bigint)`,
      bookingId
    );
  }

  private async releasePaymentLock(bookingId: string): Promise<void> {
    await prisma.$executeRawUnsafe(
      `SELECT pg_advisory_unlock(hashtext($1::text)::bigint)`,
      bookingId
    );
  }

  /** iyzico anında başarı: ödeme kaydı + APPROVED/PENDING → PAID (webhook ile idempotent). */
  private async persistSuccessfulIyzicoCharge(
    bookingId: string,
    totalPrice: number,
    paymentId: string | undefined
  ): Promise<void> {
    const txId =
      typeof paymentId === "string" && paymentId.trim()
        ? paymentId.trim()
        : `iyz_${bookingId}_${Date.now()}`;
    await prisma.$transaction(async (tx) => {
      await tx.paymentLog.upsert({
        where: { bookingId },
        create: {
          bookingId,
          transactionId: txId,
          amount: totalPrice,
          status: "SUCCESS",
        },
        update: {
          transactionId: txId,
          amount: totalPrice,
          status: "SUCCESS",
        },
      });
      await tx.booking.updateMany({
        where: {
          id: bookingId,
          status: { in: ["APPROVED", "PENDING"] },
        },
        data: { status: "PAID" },
      });
    });

    await bookingEventService.record({
      bookingId,
      event: "PAID",
      metadata: { paymentId, totalPrice: moneyToNumber(totalPrice) },
    });
  }

  /**
   * Bölünmüş ödemeyi (Marketplace Payment) başlatır.
   * "Idempotency": Aynı bookingId için mükerrer işlem yapılmasını engeller.
   */
  async initializeMarketplacePayment(
    data: MarketplacePaymentInput
  ): Promise<PaymentSdkResult> {
    const bookingForFlag = await prisma.booking.findUnique({
      where: { id: data.bookingId },
      select: { guestId: true },
    });
    if (!bookingForFlag) {
      return { status: "failure", errorMessage: "Booking not found." };
    }
    if (!(await isPaymentsEnabled({ userId: bookingForFlag.guestId ?? undefined }))) {
      return {
        status: "failure",
        errorMessage: "Payments are temporarily disabled.",
      };
    }
    if (getPaymentGateway() === 'stripe') {
      return this.initializeStripeMarketplacePayment(data);
    }
    assertIyzicoKeys();
    await this.acquirePaymentLock(data.bookingId);
    try {
      const existingLog = await prisma.paymentLog.findUnique({
        where: { bookingId: data.bookingId },
      });

      if (existingLog?.status === 'SUCCESS') {
        return { status: 'success', message: 'Already processed.' };
      }

    const request = {
      locale: Iyzipay.LOCALE.TR,
      conversationId: data.bookingId,
      price: data.totalPrice.toString(),
      paidPrice: data.totalPrice.toString(),
      currency: Iyzipay.CURRENCY.TRY,
      basketId: data.bookingId,
      paymentGroup: Iyzipay.PAYMENT_GROUP.PRODUCT,
      paymentCard: {
        cardHolderName: data.card.cardHolderName,
        cardNumber: data.card.cardNumber,
        expireMonth: data.card.expireMonth,
        expireYear: data.card.expireYear,
        cvc: data.card.cvc,
        registerCard: '0'
      },
      buyer: {
        id: data.buyer.id,
        name: data.buyer.name.split(' ')[0] || 'Guest',
        surname: data.buyer.name.split(' ')[1] || 'User',
        gsmNumber: data.buyer.phone || '+905000000000',
        email: data.buyer.email,
        identityNumber: '11111111111',
        lastLoginDate: new Date().toISOString().slice(0, 19).replace('T', ' '),
        registrationDate: new Date().toISOString().slice(0, 19).replace('T', ' '),
        registrationAddress: data.shopLocation?.address || 'Istanbul',
        ip: data.ip || '85.34.78.112',
        city: data.shopLocation?.city || 'Istanbul',
        country: 'Turkey',
        zipCode: '34000'
      },
      shippingAddress: {
        contactName: data.buyer.name,
        city: data.shopLocation?.city || 'Istanbul',
        country: 'Turkey',
        address: data.shopLocation?.address || 'Istanbul',
        zipCode: '34000'
      },
      billingAddress: {
        contactName: data.buyer.name,
        city: data.shopLocation?.city || 'Istanbul',
        country: 'Turkey',
        address: data.shopLocation?.address || 'Istanbul',
        zipCode: '34000'
      },
      basketItems: [
        {
          id: data.bookingId,
          name: "Valiz Depolama Hizmeti",
          category1: "Services",
          itemType: Iyzipay.BASKET_ITEM_TYPE.VIRTUAL,
          price: data.totalPrice.toString(),
          subMerchantKey: data.subMerchantKey,
          subMerchantPrice: data.subMerchantPrice.toString()
        }
      ]
    };

    // 3. iyzico Ödemesini Başlat (Development Bypass for Testing)
    if (process.env.NODE_ENV === "development" && (process.env.IYZICO_API_KEY === "sandbox-api-key" || !process.env.IYZICO_API_KEY)) {
      logger.info({ bookingId: data.bookingId }, "payment_simulate_success_dev");
      const paymentId = `MOCK_TX_${Date.now()}`;
      try {
        await this.persistSuccessfulIyzicoCharge(
          data.bookingId,
          data.totalPrice,
          paymentId
        );
      } catch (e) {
        if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
          logger.warn({ bookingId: data.bookingId }, "payment_init_duplicate_row");
          return { status: "success", message: "Already processed." };
        }
        throw e;
      }
      return { status: "success", paymentId };
    }

    const result = (await withTimeout(
      new Promise<PaymentSdkResult>((resolve) => {
        iyzipay.payment.create(request, (err: unknown, res: unknown) => {
          if (err) {
            resolve({
              status: 'failure',
              errorMessage:
                err instanceof Error ? err.message : String(err),
            });
          } else {
            resolve(
              typeof res === 'object' && res !== null
                ? (res as PaymentSdkResult)
                : { value: res }
            );
          }
        });
      }),
      IYZICO_OP_TIMEOUT_MS,
      'iyzico_payment_create'
    )) as PaymentSdkResult;

    if (isPaymentSuccess(result.status)) {
      try {
        const paymentId =
          typeof result.paymentId === "string" ? result.paymentId : undefined;
        await this.persistSuccessfulIyzicoCharge(
          data.bookingId,
          data.totalPrice,
          paymentId
        );
      } catch (e) {
        if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
          logger.warn(
            { bookingId: data.bookingId },
            "payment_init_duplicate_row_after_iyzico"
          );
          return { status: "success", message: "Already processed." };
        }
        throw e;
      }
    }

    return result;
    } finally {
      await this.releasePaymentLock(data.bookingId);
    }
  }

  /**
   * Stripe PaymentIntent: istemci (Stripe.js) ile onaylanır; başarı webhook ile kesinleşir.
   * Connect / bölünmüş ödeme için ileride `application_fee_amount` + `transfer_data` eklenebilir.
   */
  private async initializeStripeMarketplacePayment(
    data: MarketplacePaymentInput
  ): Promise<PaymentSdkResult> {
    await this.acquirePaymentLock(data.bookingId);
    try {
      const existingLog = await prisma.paymentLog.findUnique({
        where: { bookingId: data.bookingId },
      });

      if (existingLog?.status === "SUCCESS") {
        return { status: "success", message: "Already processed.", gateway: "stripe" };
      }

      if (
        process.env.NODE_ENV === "development" &&
        !process.env.STRIPE_SECRET_KEY?.trim()
      ) {
        logger.info({ bookingId: data.bookingId }, "stripe_payment_simulate_success_dev");
        const paymentId = `pi_dev_${Date.now()}`;
        try {
          await prisma.paymentLog.create({
            data: {
              bookingId: data.bookingId,
              transactionId: paymentId,
              amount: data.totalPrice,
              status: "SUCCESS",
            },
          });
        } catch (e) {
          if (
            e instanceof Prisma.PrismaClientKnownRequestError &&
            e.code === "P2002"
          ) {
            logger.warn({ bookingId: data.bookingId }, "stripe_payment_init_duplicate_row");
            return { status: "success", message: "Already processed.", gateway: "stripe" };
          }
          throw e;
        }
        return {
          status: "success",
          paymentIntentId: paymentId,
          gateway: "stripe",
        };
      }

      assertStripeKeys();
      const stripe = getStripe();

      // Stripe Connect: subMerchantPrice üzerinden platform komisyonu hesapla.
      // shop.stripeAccountId yoksa Stripe Connect kullanılmaz (iyzico'ya geç veya Shop'a alan ekle).
      const bookingForShop = await prisma.booking.findUnique({
        where: { id: data.bookingId },
        select: { shopId: true },
      }).catch(() => null);
      const shop = bookingForShop?.shopId
        ? await prisma.shop.findUnique({
            where: { id: bookingForShop.shopId },
            select: { stripeAccountId: true },
          }).catch(() => null)
        : null;

      const subMerchantPrice = computeSubMerchantShare(data.totalPrice);
      const platformFee = Math.round((data.totalPrice - subMerchantPrice) * 100); // kuruş

      const piParams: Parameters<typeof stripe.paymentIntents.create>[0] = {
        amount: tryAmountToStripeMinorUnits(data.totalPrice),
        currency: "try",
        metadata: { bookingId: data.bookingId },
        automatic_payment_methods: { enabled: true },
      };

      if (shop?.stripeAccountId) {
        piParams.application_fee_amount = platformFee;
        piParams.transfer_data = { destination: shop.stripeAccountId };
      } else {
        logger.warn({ bookingId: data.bookingId }, "stripe_connect_skipped_no_stripe_account_id");
      }

      const pi = await stripe.paymentIntents.create(piParams);

      return {
        status: "requires_confirmation",
        gateway: "stripe",
        clientSecret: pi.client_secret ?? undefined,
        paymentIntentId: pi.id,
      };
    } finally {
      await this.releasePaymentLock(data.bookingId);
    }
  }

  private async confirmPaidBookingAfterSuccessfulCharge(
    bookingId: string,
    externalPaymentId: string
  ): Promise<{ success: boolean; message: string }> {
    const booking = await prisma.booking.findUnique({
      where: { id: bookingId },
    });

    if (!booking) {
      console.error(`[Webhook Error] Booking not found: ${bookingId}`);
      return { success: false, message: "Booking not found" };
    }

    if (booking.status === "PAID" || booking.status === "CHECKED_IN") {
      return { success: true, message: "Already processed" };
    }
    if (booking.status !== "PENDING" && booking.status !== "APPROVED") {
      return {
        success: false,
        message: "Webhook ignored: booking not awaiting payment",
      };
    }

    try {
      const fullBooking = await prisma.booking.findUnique({
        where: { id: bookingId },
        include: { guest: true, shop: { include: { owner: true } } },
      });

      await prisma.$transaction([
        prisma.booking.update({
          where: { id: bookingId },
          data: { status: "PAID" },
        }),
        prisma.paymentLog.upsert({
          where: { transactionId: externalPaymentId },
          update: { status: "SUCCESS" },
          create: {
            bookingId,
            transactionId: externalPaymentId,
            amount: moneyToNumber(booking.totalPrice),
            status: "SUCCESS",
            splitCompleted: true,
          },
        }),
      ]);

      // Webhook yoluyla ödeme onaylandığında bildirimleri gönder
      if (fullBooking) {
        const guestEmail = fullBooking.guest?.email;
        const totalPrice = moneyToNumber(fullBooking.totalPrice);
        if (guestEmail) {
          void notificationService
            .notifyBookingSuccess(guestEmail, bookingId, totalPrice)
            .catch((e) => logger.warn({ err: e, bookingId }, "webhook_notify_guest_email_failed"));
        }
        void notificationService
          .notifyPartnerAndAdminsForNewPaidBooking({
            bookingId,
            shopName: fullBooking.shop?.name ?? "Dükkan",
            partnerPhone: fullBooking.shop?.owner?.phone,
            totalPrice,
          })
          .catch((e) => logger.warn({ err: e, bookingId }, "webhook_notify_partner_sms_failed"));
      }

      await bookingEventService.record({
        bookingId,
        event: "PAID",
        metadata: { gateway: "iyzico", externalPaymentId, totalPrice: moneyToNumber(booking.totalPrice) },
      });

      logger.info({ bookingId }, "payment_webhook_confirmed");
      return { success: true, message: "Confirmed" };
    } catch (error) {
      logger.error({ bookingId, error }, `[Webhook Error] DB Update failed`);
      throw error;
    }
  }

  /**
   * Stripe dashboard / webhook: `payment_intent.succeeded`
   */
  async confirmStripePaymentIntentSucceeded(payload: {
    id: string;
    status: string;
    metadata?: Record<string, string> | null;
  }): Promise<{ success: boolean; message: string }> {
    if (!(await isPaymentsEnabled())) {
      return { success: false, message: "Payments disabled" };
    }
    if (payload.status !== "succeeded") {
      return { success: false, message: "Stripe intent not succeeded" };
    }
    const bookingId = payload.metadata?.bookingId?.trim();
    if (!bookingId) {
      return { success: false, message: "Missing bookingId in PaymentIntent metadata" };
    }
    return this.confirmPaidBookingAfterSuccessfulCharge(bookingId, payload.id);
  }

  /**
   * iyzico Webhook (Callback) İşleyicisi
   * Asenkron ödeme onaylarını (Bankadan bağımsız) doğrular ve işler.
   */
  async processWebhook(payload: {
    status: string;
    paymentId: string;
    /** Direct webhook: paymentConversationId; API yanıtı: conversationId */
    conversationId: string;
    merchantId?: string;
    hash?: string;
  }): Promise<{ success: boolean; message: string }> {
    if (!(await isPaymentsEnabled())) {
      return { success: false, message: "Payments disabled" };
    }
    const { status, paymentId, conversationId } = payload;

    if (!isPaymentSuccess(status)) {
      return { success: false, message: "Webhook ignored: status not success" };
    }

    if (!paymentId?.trim()) {
      return { success: false, message: "Missing payment id" };
    }

    return this.confirmPaidBookingAfterSuccessfulCharge(conversationId, paymentId);
  }

  /**
   * iyzico İade (Refund) İşlemi
   * Misafir iptalleri (UC_M_07) için parayı iyzico üzerinden geri gönderir.
   */
  async refundPayment(
    bookingId: string,
    amount: number,
    options?: { keepPaymentLogSuccess?: boolean }
  ): Promise<PaymentSdkResult> {
    if (!(await isPaymentsEnabled())) {
      return {
        status: "failure",
        errorMessage: "Payments are temporarily disabled.",
      };
    }
    // 1. Orijinal ödeme kaydını bul (Transaction ID gerekiyor)
    const paymentLog = await prisma.paymentLog.findFirst({
      where: { bookingId, status: "SUCCESS" }
    });

    if (!paymentLog || !paymentLog.transactionId) {
      throw new Error(`Refund failed: Original payment not found for booking ${bookingId}`);
    }

    const txId = paymentLog.transactionId;

    // QA bypass: payments created via MOBILE_PAYMENT_BYPASS have no real
    // gateway txn behind them, so simulate a refund instead of calling
    // Stripe/iyzico (which would fail). Mark the log REFUNDED on full
    // refund so reconciliation stays consistent.
    if (txId.startsWith("bypass_")) {
      logger.warn({ bookingId, amount }, "mobile_refund_bypassed");
      if (!options?.keepPaymentLogSuccess) {
        const isFullRefund = amount >= moneyToNumber(paymentLog.amount);
        if (isFullRefund) {
          await prisma.paymentLog.update({
            where: { id: paymentLog.id },
            data: { status: "REFUNDED" },
          });
        }
      }
      return { status: "success", amount };
    }

    if (isStripePaymentIntentId(txId)) {
      if (
        process.env.NODE_ENV === "development" &&
        txId.startsWith("pi_dev_")
      ) {
        logger.info({ bookingId }, "stripe_refund_simulate_success_dev");
        if (!options?.keepPaymentLogSuccess) {
          const isFullRefund = amount >= moneyToNumber(paymentLog.amount);
          if (isFullRefund) {
            await prisma.paymentLog.update({
              where: { id: paymentLog.id },
              data: { status: "REFUNDED" },
            });
          }
        }
        return { status: "success", amount };
      }

      assertStripeKeys();
      const stripe = getStripe();
      const refundParams: { payment_intent: string; amount?: number } = {
        payment_intent: txId,
      };
      if (amount > 0) {
        refundParams.amount = tryAmountToStripeMinorUnits(amount);
      }
      const refund = await stripe.refunds.create(refundParams);

      if (refund.status === "failed" || refund.status === "canceled") {
        return {
          status: "failure",
          errorMessage: refund.failure_reason ?? "Stripe refund failed",
        };
      }

      if (!options?.keepPaymentLogSuccess) {
        const isFullRefund = amount >= moneyToNumber(paymentLog.amount);
        if (isFullRefund) {
          await prisma.paymentLog.update({
            where: { id: paymentLog.id },
            data: { status: "REFUNDED" },
          });
        }
      }

      return { status: "success", amount, refundId: refund.id };
    }

    assertIyzicoKeys();

    // 2. Geliştirme Modu Bypass
    if (process.env.NODE_ENV === "development" && (!process.env.IYZICO_API_KEY || process.env.IYZICO_API_KEY === "sandbox-api-key")) {
      logger.info({ bookingId }, "payment_refund_simulate_success_dev");
      return { status: "success", amount };
    }

    // 3. iyzico İade İsteği
    const request = {
      locale: Iyzipay.LOCALE.TR,
      conversationId: bookingId,
      paymentTransactionId: paymentLog.transactionId,
      price: amount.toString(),
      currency: Iyzipay.CURRENCY.TRY,
      ip: '127.0.0.1' // Refund calls are server-to-server internal
    };

    const result = (await withTimeout(
      new Promise<PaymentSdkResult>((resolve) => {
        iyzipay.refund.create(request, (err: unknown, res: unknown) => {
          if (err) {
            resolve({
              status: 'failure',
              errorMessage:
                err instanceof Error ? err.message : String(err),
            });
          } else {
            resolve(
              typeof res === 'object' && res !== null
                ? (res as PaymentSdkResult)
                : { value: res }
            );
          }
        });
      }),
      IYZICO_OP_TIMEOUT_MS,
      'iyzico_refund_create'
    )) as PaymentSdkResult;

    // 4. Logla (kısmi iade: örn. rezervasyon düzenleme — kayıt SUCCESS kalır, tekrar iade mümkün)
    if (isPaymentSuccess(result.status) && !options?.keepPaymentLogSuccess) {
      const isFullRefund = amount >= moneyToNumber(paymentLog.amount);
      if (isFullRefund) {
        await prisma.paymentLog.update({
          where: { id: paymentLog.id },
          data: { status: "REFUNDED" }
        });
      }
    }

    return result;
  }

  /**
   * Booking PENDING + PaymentLog SUCCESS tutarsızlığı: webhook veya DB transaction yarışı sonrası.
   * Cron veya manuel tetikleme ile çalıştırılmalıdır.
   */
  async reconcileStalePaymentBookings(): Promise<{
    fixed: number;
    bookingIds: string[];
  }> {
    const stuck = await prisma.booking.findMany({
      where: {
        status: { in: ['PENDING', 'APPROVED'] },
        paymentLog: { is: { status: 'SUCCESS' } },
      },
      include: {
        paymentLog: true,
        guest: true,
        shop: { include: { owner: true } }
      },
    });
    const bookingIds = stuck.map((b) => b.id);
    if (bookingIds.length > 0) {
      await prisma.booking.updateMany({
        where: { id: { in: bookingIds } },
        data: { status: 'PAID' },
      });

      for (const b of stuck) {
        logger.info({ bookingId: b.id }, 'finance_reconcile_pending_or_approved_to_paid');

        bookingEventService.record({
          bookingId: b.id,
          event: "PAID",
          metadata: { reconciled: true },
        }).catch((err) => logger.error({ err, bookingId: b.id }, 'reconcile_event_failed'));

        const guestEmail = b.guest?.email;
        const totalPrice = moneyToNumber(b.totalPrice);
        if (guestEmail) {
          void notificationService
            .notifyBookingSuccess(guestEmail, b.id, totalPrice)
            .catch((e) => logger.warn({ err: e, bookingId: b.id }, 'reconcile_notify_guest_failed'));
        }
        void notificationService
          .notifyPartnerAndAdminsForNewPaidBooking({
            bookingId: b.id,
            shopName: b.shop?.name ?? 'Dükkan',
            partnerPhone: b.shop?.owner?.phone,
            totalPrice,
          })
          .catch((e) => logger.warn({ err: e, bookingId: b.id }, 'reconcile_notify_partner_failed'));
      }
    }
    recordMetric('reconcile_payments_complete', {
      fixed: stuck.length,
      sampleBookingIds: bookingIds.slice(0, 25),
    });
    return { fixed: stuck.length, bookingIds };
  }

  /**
   * Misafir: esnaf onayı (APPROVED) veya ödeme bekleyen (PENDING) rezervasyon için Stripe PaymentIntent.
   * Payment Element + Apple Pay / Google Pay (Stripe Dashboard ayarına bağlı).
   */
  async createStripePaymentIntentForGuestBooking(params: {
    bookingId: string;
    guestId: string;
  }): Promise<
    | { ok: true; clientSecret: string; paymentIntentId: string }
    | { ok: false; errorCode: string }
  > {
    if (!(await isPaymentsEnabled({ userId: params.guestId }))) {
      return { ok: false, errorCode: "payments_disabled" };
    }
    if (getPaymentGateway() !== "stripe") {
      return { ok: false, errorCode: "gateway_not_stripe" };
    }
    if (!process.env.STRIPE_SECRET_KEY?.trim()) {
      return { ok: false, errorCode: "stripe_not_configured" };
    }

    const booking = await prisma.booking.findUnique({
      where: { id: params.bookingId },
    });

    if (!booking || booking.guestId !== params.guestId) {
      return { ok: false, errorCode: "booking_not_found" };
    }

    if (booking.status !== "APPROVED" && booking.status !== "PENDING") {
      return { ok: false, errorCode: "invalid_booking_status" };
    }

    const existingLog = await prisma.paymentLog.findUnique({
      where: { bookingId: params.bookingId },
    });
    if (existingLog?.status === "SUCCESS") {
      return { ok: false, errorCode: "already_paid" };
    }

    const amountTry = moneyToNumber(booking.totalPrice);
    if (!Number.isFinite(amountTry) || amountTry <= 0) {
      return { ok: false, errorCode: "invalid_amount" };
    }

    try {
      assertStripeKeys();
      const stripe = getStripe();
      const pi = await stripe.paymentIntents.create({
        amount: tryAmountToStripeMinorUnits(amountTry),
        currency: "try",
        metadata: { bookingId: booking.id },
        automatic_payment_methods: { enabled: true },
      });
      const cs = pi.client_secret;
      if (!cs) {
        return { ok: false, errorCode: "stripe_no_client_secret" };
      }
      return { ok: true, clientSecret: cs, paymentIntentId: pi.id };
    } catch (error: unknown) {
      logger.error(
        { err: error, bookingId: params.bookingId },
        "stripe_booking_pi_create_failed"
      );
      return { ok: false, errorCode: "stripe_error" };
    }
  }

  /**
   * iyzico Alt-Üye Güncelleme
   */
  async updateSubMerchant(data: {
    subMerchantKey: string;
    name: string;
    address: string;
    email: string;
    phone: string;
  }): Promise<PaymentSdkResult> {
    if (!(await isPaymentsEnabled())) {
      return {
        status: "failure",
        errorMessage: "Payments are temporarily disabled.",
      };
    }
    if (getPaymentGateway() === "stripe") {
      return {
        status: "failure",
        errorMessage:
          "Sub-merchant updates apply to iyzico marketplace only (PAYMENT_GATEWAY=iyzico).",
      };
    }
    assertIyzicoKeys();
    const request = {
      locale: Iyzipay.LOCALE.TR,
      subMerchantKey: data.subMerchantKey,
      name: data.name,
      address: data.address,
      contactEmail: data.email,
      contactPhoneNumber: data.phone,
      // Bazı zorunlu alanlar modelde eksikse varsayılan veya mevcut değerler kullanılmalı
      city: "Istanbul",
      country: "Turkey",
    };

    if (process.env.NODE_ENV === "development" && (!process.env.IYZICO_API_KEY || process.env.IYZICO_API_KEY === "sandbox-api-key")) {
      logger.info({ subMerchantKey: data.subMerchantKey }, "payment_submerchant_update_simulate_success_dev");
      return { status: "success" };
    }

    return new Promise<PaymentSdkResult>((resolve) => {
      iyzipay.subMerchant.update(request, (err: unknown, res: unknown) => {
        if (err) {
          resolve({
            status: 'failure',
            errorMessage: err instanceof Error ? err.message : String(err),
          });
        } else {
          resolve(res as PaymentSdkResult);
        }
      });
    });
  }
}

export const paymentService = new PaymentService();
