"use client";

import { useEffect } from "react";
import { useRouter } from "@/i18n/routing";
import { useTranslations } from "next-intl";
import { finalizeStripeBookingPaymentAction } from "@/actions/stripe-booking-payment";

type Props = {
  bookingId: string;
  paymentIntentId?: string;
  redirectStatus?: string;
};

/**
 * Stripe 3DS / redirect sonrası `?payment_intent=…` ile dönüşte
 * ödemeyi veritabanıyla senkronlar ve URL’den sorgu parametrelerini temizler.
 */
export default function BookingStripeReturnSync({
  bookingId,
  paymentIntentId,
  redirectStatus,
}: Props) {
  const t = useTranslations("Guest");
  const router = useRouter();
  const redirectFailed =
    redirectStatus === "failed" || redirectStatus === "canceled";

  useEffect(() => {
    if (!paymentIntentId) return;

    if (redirectFailed) return;

    let cancelled = false;

    void (async () => {
      await finalizeStripeBookingPaymentAction(paymentIntentId);
      if (cancelled) return;
      router.replace(`/bookings/${bookingId}`);
      router.refresh();
    })();

    return () => {
      cancelled = true;
    };
  }, [bookingId, paymentIntentId, redirectFailed, router]);

  if (!paymentIntentId) {
    return null;
  }

  if (redirectFailed) {
    return (
      <div
        role="alert"
        className="mb-4 rounded-2xl border border-red-100 bg-red-50 p-4 text-sm font-medium text-red-800"
      >
        {t("payBookingReturnFailed")}
      </div>
    );
  }

  return (
    <div className="mb-4 rounded-2xl border border-amber-100 bg-amber-50 p-4 text-sm font-medium text-amber-900">
      {t("payBookingReturnSyncing")}
    </div>
  );
}
