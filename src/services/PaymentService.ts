import { iyzipay, assertIyzicoKeys } from "@/lib/iyzipay";
import Iyzipay from 'iyzipay';
import prisma from '@/lib/db';
import { isPaymentSuccess } from '@/lib/payment-status';

export interface IPaymentService {
  initializeMarketplacePayment(data: any): Promise<any>;
  refundPayment(bookingId: string, amount: number): Promise<any>;
}

/**
 * PaymentService - iyzico Marketplace (Split Payment) Entegrasyonu
 * SOLID: Single Responsibility
 * Paranın esnaf ve platform arasında bölünmesini yönetir.
 */
export class PaymentService implements IPaymentService {
  /**
   * Bölünmüş ödemeyi (Marketplace Payment) başlatır.
   * "Idempotency": Aynı bookingId için mükerrer işlem yapılmasını engeller.
   */
  async initializeMarketplacePayment(data: {
    bookingId: string;
    totalPrice: number;
    subMerchantKey: string;
    subMerchantPrice: number;
    card: any;
    buyer: any;
  }): Promise<any> {
    assertIyzicoKeys();
    // 1. İdempolans Kontrolü (Duplicate Payment Prevention)
    const existingLog = await prisma.paymentLog.findFirst({
      where: { bookingId: data.bookingId, status: "SUCCESS" }
    });

    if (existingLog) {
      return { status: "success", message: "Already processed." };
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
        lastLoginDate: '2023-10-05 12:43:35',
        registrationDate: '2023-10-05 12:43:35',
        registrationAddress: 'Nisantasi Istanbul',
        ip: '85.34.78.112',
        city: 'Istanbul',
        country: 'Turkey',
        zipCode: '34732'
      },
      shippingAddress: {
        contactName: data.buyer.name,
        city: 'Istanbul',
        country: 'Turkey',
        address: 'Nisantasi Istanbul',
        zipCode: '34732'
      },
      billingAddress: {
        contactName: data.buyer.name,
        city: 'Istanbul',
        country: 'Turkey',
        address: 'Nisantasi Istanbul',
        zipCode: '34732'
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
      console.log("💰 [DEV MODE] Simulating successful payment for booking:", data.bookingId);
      const paymentId = `MOCK_TX_${Date.now()}`;
      await prisma.paymentLog.create({
        data: {
          bookingId: data.bookingId,
          transactionId: paymentId,
          amount: data.totalPrice,
          status: "SUCCESS",
        },
      });
      return { status: "success", paymentId };
    }

    const result: any = await new Promise((resolve) => {
      iyzipay.payment.create(request, (err: any, res: any) => {
        if (err) resolve({ status: 'failure', errorMessage: err.message });
        else resolve(res);
      });
    });

    // 2. İşlemi Logla
    if (isPaymentSuccess(result.status)) {
      await prisma.paymentLog.create({
        data: {
          bookingId: data.bookingId,
          transactionId: result.paymentId,
          amount: data.totalPrice,
          status: "SUCCESS"
        }
      });
    }

    return result;
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

    // 3. İdempolans (Zaten onaylıysa tekrar işlem yapma)
    if (booking.status === 'PAID' || booking.status === 'CHECKED_IN') {
      return { success: true, message: "Already processed" };
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
            amount: booking.totalPrice,
            status: 'SUCCESS',
            splitCompleted: true
          }
        })
      ]);

      console.log(`[Webhook Success] Booking ${conversationId} confirmed via Webhook.`);
      return { success: true, message: "Confirmed" };
    } catch (error) {
      console.error(`[Webhook Error] DB Update failed for ${conversationId}:`, error);
      throw error; // Üst katmanda 500 dönmesi için (iyzico tekrar denesin)
    }
  }

  /**
   * iyzico İade (Refund) İşlemi
   * Misafir iptalleri (UC_M_07) için parayı iyzico üzerinden geri gönderir.
   */
  async refundPayment(bookingId: string, amount: number): Promise<any> {
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
      console.log("💰 [DEV MODE] Simulating successful refund for booking:", bookingId);
      return { status: "success", amount };
    }

    // 3. iyzico İade İsteği
    const request = {
      locale: Iyzipay.LOCALE.TR,
      conversationId: bookingId,
      paymentTransactionId: paymentLog.transactionId,
      price: amount.toString(),
      currency: Iyzipay.CURRENCY.TRY,
      ip: '85.34.78.112'
    };

    const result: any = await new Promise((resolve) => {
      iyzipay.refund.create(request, (err: any, res: any) => {
        if (err) resolve({ status: 'failure', errorMessage: err.message });
        else resolve(res);
      });
    });

    // 4. Logla
    if (isPaymentSuccess(result.status)) {
      await prisma.paymentLog.update({
        where: { id: paymentLog.id },
        data: { status: "REFUNDED" }
      });
    }

    return result;
  }
}

export const paymentService = new PaymentService();
