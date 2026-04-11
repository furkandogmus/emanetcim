"use client";

import { useMemo, useState, type FormEvent } from "react";
import {
  loadStripe,
  type StripeExpressCheckoutElementConfirmEvent,
  type StripeExpressCheckoutElementReadyEvent,
} from "@stripe/stripe-js";
import { stripeElementsLocaleFromAppLocale } from "@/lib/stripe-checkout";
import {
  Elements,
  ExpressCheckoutElement,
  PaymentElement,
  useStripe,
  useElements,
} from "@stripe/react-stripe-js";
import { useLocale, useTranslations } from "next-intl";
import { useRouter } from "@/i18n/routing";
import { Link } from "@/i18n/routing";
import { finalizeStripeBookingPaymentAction } from "@/actions/stripe-booking-payment";
import { ChevronLeft } from "lucide-react";

type ExpressUi = "loading" | "wallets" | "empty";

type PeWalletDedupe = {
  applePay: boolean;
  googlePay: boolean;
  link: boolean;
} | null;

function PayForm({
  bookingId,
  clientSecret,
}: {
  bookingId: string;
  clientSecret: string;
}) {
  const stripe = useStripe();
  const elements = useElements();
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [expressUi, setExpressUi] = useState<ExpressUi>("loading");
  const [peWalletDedupe, setPeWalletDedupe] = useState<PeWalletDedupe>(null);
  const t = useTranslations("Guest");
  const locale = useLocale();
  const router = useRouter();

  const confirmPayment = async (
    expressEvent: StripeExpressCheckoutElementConfirmEvent | null
  ): Promise<"navigated" | "error" | "pending"> => {
    if (!stripe || !elements) return "error";

    const returnUrl = `${window.location.origin}/${locale}/bookings/${bookingId}`;

    const fail = (msg: string) => {
      if (expressEvent) {
        expressEvent.paymentFailed({ message: msg });
      } else {
        setMessage(msg);
      }
    };

    const { error: submitError } = await elements.submit();
    if (submitError) {
      fail(submitError.message ?? t("payBookingFailed"));
      return "error";
    }

    const { error, paymentIntent } = await stripe.confirmPayment({
      elements,
      clientSecret,
      confirmParams: {
        return_url: returnUrl,
      },
      redirect: "if_required",
    });

    if (error) {
      fail(error.message ?? t("payBookingFailed"));
      return "error";
    }

    if (paymentIntent?.status === "succeeded") {
      const fin = await finalizeStripeBookingPaymentAction(paymentIntent.id);
      if (fin.ok) {
        router.push(`/bookings/${bookingId}`);
        router.refresh();
        return "navigated";
      }
      fail(t("payBookingFinalizeFailed"));
      return "error";
    }

    return "pending";
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!stripe || !elements) return;
    setBusy(true);
    setMessage(null);
    const result = await confirmPayment(null);
    if (result !== "navigated") setBusy(false);
  };

  const handleExpressReady = (e: StripeExpressCheckoutElementReadyEvent) => {
    const m = e.availablePaymentMethods;
    const hasWallets = !!(
      m &&
      (m.applePay ||
        m.googlePay ||
        m.link ||
        m.paypal ||
        m.amazonPay ||
        m.klarna)
    );

    if (!m || !hasWallets) {
      setExpressUi("empty");
      setPeWalletDedupe({ applePay: false, googlePay: false, link: false });
      return;
    }

    setExpressUi("wallets");
    setPeWalletDedupe({
      applePay: !!m.applePay,
      googlePay: !!m.googlePay,
      link: !!m.link,
    });
  };

  const paymentElementOptions = useMemo(
    () => ({
      layout: { type: "tabs" as const, defaultCollapsed: false },
      wallets:
        peWalletDedupe === null
          ? undefined
          : {
              applePay: peWalletDedupe.applePay ? ("never" as const) : ("auto" as const),
              googlePay: peWalletDedupe.googlePay ? ("never" as const) : ("auto" as const),
              link: peWalletDedupe.link ? ("never" as const) : ("auto" as const),
            },
    }),
    [peWalletDedupe]
  );

  return (
    <div className="flex flex-col gap-6">
      <div
        className={
          expressUi === "empty"
            ? "hidden"
            : expressUi === "wallets"
              ? "rounded-2xl border border-gray-100 bg-white p-4 shadow-sm"
              : ""
        }
      >
        <ExpressCheckoutElement
          options={{
            buttonType: {
              applePay: "plain",
              googlePay: "pay",
            },
          }}
          onReady={handleExpressReady}
          onConfirm={async (ev) => {
            setBusy(true);
            setMessage(null);
            const result = await confirmPayment(ev);
            if (result !== "navigated") setBusy(false);
          }}
        />
      </div>

      {expressUi === "wallets" ? (
        <div className="relative flex items-center gap-4 py-1">
          <div className="h-px flex-1 bg-gray-200" />
          <span className="text-xs font-bold uppercase tracking-widest text-gray-400">
            {t("payBookingDivider")}
          </span>
          <div className="h-px flex-1 bg-gray-200" />
        </div>
      ) : null}

      <form onSubmit={handleSubmit} className="flex flex-col gap-6">
        <div className="rounded-2xl border border-gray-100 bg-white p-4 shadow-sm">
          <PaymentElement options={paymentElementOptions} />
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
    </div>
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
  const locale = useLocale();
  const stripePromise = useMemo(
    () => loadStripe(publishableKey),
    [publishableKey]
  );
  const elementsOptions = useMemo(
    () => ({
      clientSecret,
      locale: stripeElementsLocaleFromAppLocale(locale),
      appearance: { theme: "stripe" as const, variables: { colorPrimary: "#ea580c" } },
    }),
    [clientSecret, locale]
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
      <Elements stripe={stripePromise} options={elementsOptions}>
        <PayForm bookingId={bookingId} clientSecret={clientSecret} />
      </Elements>
    </div>
  );
}
