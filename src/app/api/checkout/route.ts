import { NextResponse, after } from "next/server";
import { paymentService } from "@/services/PaymentService";
import { notificationService } from "@/services/NotificationService";
import { getRequestLogger } from "@/lib/request-logger";
import { isPaymentSuccess } from "@/lib/payment-status";
import { rateLimit } from "@/lib/rate-limit";

/**
 * Checkout API - Next.js 15 'after' API ile Asenkron İşlemler
 * "Senior" Checklist: Async Jobs (Non-blocking).
 * Ödeme bittikten sonra bildirimleri arka planda gönderir.
 */
export async function POST(req: Request) {
  const logger = await getRequestLogger();
  try {
    const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "local";
    if (!rateLimit(`checkout:${ip}`, 30, 60_000)) {
      return NextResponse.json({ success: false, error: "Too many requests" }, { status: 429 });
    }

    const body = await req.json();

    // 1. Kritik İşlem: Ödemeyi başlat
    const paymentResult = await paymentService.initializeMarketplacePayment(body);

    if (!isPaymentSuccess(paymentResult.status)) {
      return NextResponse.json({ success: false, error: "Payment failed" }, { status: 400 });
    }

    // 2. 'after' API: Yanıt gönderildikten sonra arka planda çalışacak işler (Non-blocking)
    after(async () => {
      logger.info("[Async] Starting background tasks after response...");
      
      // Bildirim gönder (Graceful Degradation: Bildirim hatası ödemeyi bozmaz)
      await notificationService.notifyBookingSuccess(body.buyer.email, body.bookingId, body.totalPrice);
      
      logger.info("[Async] Background tasks completed.");
    });

    // Kullanıcıya hemen yanıt dön (Maksimum Hız)
    return NextResponse.json({ 
      success: true, 
      message: "Payment processed successfully. Notifications are being sent." 
    });

  } catch (error) {
    logger.error({ err: error }, "Checkout API Error");
    return NextResponse.json({ success: false, error: "Internal Server Error" }, { status: 500 });
  }
}
