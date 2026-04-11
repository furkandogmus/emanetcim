import { iyzipay, assertIyzicoKeys } from "@/lib/iyzipay";
import Iyzipay from 'iyzipay';
import { Prisma } from '@prisma/client';
import prisma from '@/lib/db';
import { isPaymentSuccess } from '@/lib/payment-status';
import { moneyToNumber } from '@/lib/money';
import logger from '@/lib/logger';
import { withTimeout } from '@/lib/async-timeout';
import { isPaymentsEnabled } from '@/lib/feature-flags';

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

  /**
   * Bölünmüş ödemeyi (Marketplace Payment) başlatır.
   * "Idempotency": Aynı bookingId için mükerrer işlem yapılmasını engeller.
   */
  async initializeMarketplacePayment(
    data: MarketplacePaymentInput
  ): Promise<PaymentSdkResult> {
    if (!isPaymentsEnabled()) {
      return {
        status: 'failure',
        errorMessage: 'Payments disabled (PAYMENTS_ENABLED=false).',
      };
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
        await prisma.paymentLog.create({
          data: {
            bookingId: data.bookingId,
            transactionId: paymentId,
            amount: data.totalPrice,
            status: "SUCCESS",
          },
        });
      } catch (e) {
        if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
          logger.warn({ bookingId: data.bookingId }, 'payment_init_duplicate_row');
          return { status: 'success', message: 'Already processed.' };
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

    // 2. İşlemi Logla
    if (isPaymentSuccess(result.status)) {
      try {
        const paymentId =
          typeof result.paymentId === 'string' ? result.paymentId : undefined;
        await prisma.paymentLog.create({
          data: {
            bookingId: data.bookingId,
            transactionId: paymentId,
            amount: data.totalPrice,
            status: "SUCCESS"
          }
        });
      } catch (e) {
        if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
          logger.warn({ bookingId: data.bookingId }, 'payment_init_duplicate_row_after_iyzico');
          return { status: 'success', message: 'Already processed.' };
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
    if (!isPaymentsEnabled()) {
      return { success: false, message: 'Payments disabled (PAYMENTS_ENABLED=false)' };
    }
    const { status, paymentId, conversationId } = payload;

    // 1. Durum Kontrolü (Sadece başarılı ödemeleri işle)
    if (!isPaymentSuccess(status)) {
      return { success: false, message: "Webhook ignored: status not success" };
    }

    // 2. Rezervasyonu bul
    const booking = await prisma.booking.findUnique({
      where: { id: conversationId }
    });

    if (!booking) {
      console.error(`[Webhook Error] Booking not found: ${conversationId}`);
      return { success: false, message: "Booking not found" };
    }

    // 3. İdempolans ve terminal durumlar (webhook yalnızca PENDING -> PAID)
    if (booking.status === 'PAID' || booking.status === 'CHECKED_IN') {
      return { success: true, message: "Already processed" };
    }
    if (booking.status !== 'PENDING') {
      return {
        success: false,
        message: "Webhook ignored: booking not awaiting payment",
      };
    }

    // 4. Onay İşlemi (Transaction içinde)
    try {
      await prisma.$transaction([
        prisma.booking.update({
          where: { id: conversationId },
          data: { status: 'PAID' }
        }),
        prisma.paymentLog.upsert({
          where: { transactionId: paymentId },
          update: { status: 'SUCCESS' },
          create: {
            bookingId: conversationId,
            transactionId: paymentId,
            amount: moneyToNumber(booking.totalPrice),
            status: 'SUCCESS',
            splitCompleted: true
          }
        })
      ]);

      logger.info({ bookingId: conversationId }, "payment_webhook_confirmed");
      return { success: true, message: "Confirmed" };
    } catch (error) {
      logger.error({ conversationId, error }, `[Webhook Error] DB Update failed`);
      throw error; // Üst katmanda 500 dönmesi için (iyzico tekrar denesin)
    }
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
    if (!isPaymentsEnabled()) {
      return {
        status: 'failure',
        errorMessage: 'Payments disabled (PAYMENTS_ENABLED=false).',
      };
    }
    assertIyzicoKeys();
    // 1. Orijinal ödeme kaydını bul (Transaction ID gerekiyor)
    const paymentLog = await prisma.paymentLog.findFirst({
      where: { bookingId, status: "SUCCESS" }
    });

    if (!paymentLog || !paymentLog.transactionId) {
      throw new Error(`Refund failed: Original payment not found for booking ${bookingId}`);
    }

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
      await prisma.paymentLog.update({
        where: { id: paymentLog.id },
        data: { status: "REFUNDED" }
      });
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
        status: 'PENDING',
        paymentLogs: { some: { status: 'SUCCESS' } },
      },
      select: { id: true },
    });
    const bookingIds: string[] = [];
    for (const b of stuck) {
      await prisma.booking.update({
        where: { id: b.id },
        data: { status: 'PAID' },
      });
      bookingIds.push(b.id);
      logger.info({ bookingId: b.id }, 'finance_reconcile_pending_to_paid');
    }
    return { fixed: stuck.length, bookingIds };
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
    if (!isPaymentsEnabled()) {
      return {
        status: 'failure',
        errorMessage: 'Payments disabled (PAYMENTS_ENABLED=false).',
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
