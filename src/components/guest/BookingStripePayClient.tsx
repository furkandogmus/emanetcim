"use client";

import { useMemo, useState, type FormEvent } from "react";
import { loadStripe } from "@stripe/stripe-js";
import {
  Elements,
  PaymentElement,
  useStripe,
  useElements,
} from "@stripe/react-stripe-js";
import { useLocale, useTranslations } from "next-intl";
import { useRouter } from "@/i18n/routing";
import { Link } from "@/i18n/routing";
import { finalizeStripeBookingPaymentAction } from "@/actions/stripe-booking-payment";
import { ChevronLeft } from "lucide-react";

function PayForm({ bookingId }: { bookingId: string }) {
  const stripe = useStripe();
  const elements = useElements();
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const t = useTranslations("Guest");
  const locale = useLocale();
  const router = useRouter();

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!stripe || !elements) return;
    setBusy(true);
    setMessage(null);

    const returnUrl = `${window.location.origin}/${locale}/bookings/${bookingId}`;

    const { error, paymentIntent } = await stripe.confirmPayment({
      elements,
      confirmParams: {
        return_url: returnUrl,
      },
      redirect: "if_required",
    });

    if (error) {
      setMessage(error.message ?? t("payBookingFailed"));
      setBusy(false);
      return;
    }

    if (paymentIntent?.status === "succeeded") {
      const fin = await finalizeStripeBookingPaymentAction(paymentIntent.id);
      if (fin.ok) {
        router.push(`/bookings/${bookingId}`);
        router.refresh();
        return;
      }
      setMessage(t("payBookingFinalizeFailed"));
      setBusy(false);
      return;
    }

    setBusy(false);
  };

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-6">
      <div className="rounded-2xl border border-gray-100 bg-white p-4 shadow-sm">
        <PaymentElement />
      </div>
      {message ? (
        <p className="text-sm font-bold text-red-600" role="alert">
          {message}
        </p>
      ) : null}
      <button
        type="submit"
        disabled={!stripe || busy}
        className="w-full rounded-2xl bg-orange-600 py-4 text-sm font-black uppercase tracking-widest text-white shadow-lg shadow-orange-200 transition hover:bg-orange-700 disabled:opacity-50"
      >
        {busy ? t("payBookingProcessing") : t("payBookingSubmit")}
      </button>
    </form>
  );
}

export default function BookingStripePayClient({
  bookingId,
  clientSecret,
  publishableKey,
}: {
  bookingId: string;
  clientSecret: string;
  publishableKey: string;
}) {
  const t = useTranslations("Guest");
  const stripePromise = useMemo(
    () => loadStripe(publishableKey),
    [publishableKey]
  );

  return (
    <div className="mx-auto flex min-h-screen max-w-md flex-col gap-6 px-6 pb-24 pt-28">
      <Link
        href={`/bookings/${bookingId}`}
        className="inline-flex items-center gap-2 text-xs font-black uppercase tracking-widest text-gray-400 hover:text-orange-600"
      >
        <ChevronLeft size={16} aria-hidden />
        {t("payBookingBack")}
      </Link>
      <div>
        <h1 className="text-2xl font-black text-gray-900">{t("payBookingTitle")}</h1>
        <p className="mt-2 text-sm font-medium text-gray-500">{t("payBookingSubtitle")}</p>
      </div>
      <Elements
        stripe={stripePromise}
        options={{
          clientSecret,
          appearance: { theme: "stripe", variables: { colorPrimary: "#ea580c" } },
        }}
      >
        <PayForm bookingId={bookingId} />
      </Elements>
    </div>
  );
}
