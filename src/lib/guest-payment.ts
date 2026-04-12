import { isPaymentsEnabled } from "@/lib/feature-flags";
import { getPaymentGateway } from "@/lib/payment-gateway";

/**
 * Misafir “onay sonrası ödeme” (/bookings/[id]/pay) için çevrimiçi ödeme açık mı.
 * PAYMENT_GATEWAY hangi sağlayıcıyı seçtiğinize göre Stripe veya iyzico anahtarları gerekir.
 */
export async function isGuestOnlinePayEnabled(options?: {
  userId?: string;
}): Promise<boolean> {
  if (!(await isPaymentsEnabled(options))) return false;
  if (getPaymentGateway() === "stripe") {
    return (
      !!process.env.STRIPE_SECRET_KEY?.trim() &&
      !!process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY?.trim()
    );
  }
  return (
    !!process.env.IYZICO_API_KEY?.trim() &&
    !!process.env.IYZICO_SECRET_KEY?.trim()
  );
}

export async function isIyzicoGuestPayEnabled(options?: {
  userId?: string;
}): Promise<boolean> {
  return (
    (await isPaymentsEnabled(options)) &&
    getPaymentGateway() === "iyzico" &&
    !!process.env.IYZICO_API_KEY?.trim() &&
    !!process.env.IYZICO_SECRET_KEY?.trim()
  );
}
