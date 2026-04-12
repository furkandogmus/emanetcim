"use client";

import { useMemo, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import {
  AlertCircle,
  CreditCard,
  Lock,
  User,
  ChevronLeft,
  Loader2,
} from "lucide-react";
import { Link, useRouter } from "@/i18n/routing";
import { payBookingWithIyzicoAction } from "@/actions/iyzico-booking-payment";
import { formatTryCurrency } from "@/lib/currency";

type Props = {
  bookingId: string;
  shopName: string;
  totalTry: number;
};

export default function BookingIyzicoPayClient({
  bookingId,
  shopName,
  totalTry,
}: Props) {
  const t = useTranslations("Guest");
  const tErr = useTranslations("Errors");
  const locale = useLocale();
  const router = useRouter();

  const [cardHolder, setCardHolder] = useState("");
  const [cardNumber, setCardNumber] = useState("");
  const [expiry, setExpiry] = useState("");
  const [cvv, setCvv] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const formattedTotal = useMemo(
    () => formatTryCurrency(totalTry, locale),
    [totalTry, locale],
  );

  const handleCardNumberChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value.replace(/\D/g, "");
    const formatted = val.match(/.{1,4}/g)?.join(" ") || val;
    setCardNumber(formatted.substring(0, 19));
  };

  const handleExpiryChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let val = e.target.value.replace(/\D/g, "");
    if (val.length >= 2) {
      const month = parseInt(val.substring(0, 2), 10);
      if (month > 12) val = "12" + val.substring(2);
      else if (month === 0 && val.length >= 2) val = "01" + val.substring(2);
      val = val.substring(0, 2) + "/" + val.substring(2, 4);
    }
    setExpiry(val);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    const stripped = cardNumber.replace(/\s/g, "");
    const [expMonth, expYearRaw] = expiry.split("/");
    const expYearDigits = (expYearRaw ?? "").replace(/\D/g, "").slice(-2);
    const expireYear =
      expYearDigits.length === 2
        ? `20${expYearDigits}`
        : new Date().getFullYear().toString();

    if (
      !cardHolder.trim() ||
      stripped.length < 16 ||
      !expMonth ||
      expYearDigits.length < 2 ||
      cvv.length < 3
    ) {
      setError(t("checkoutCardValidationError"));
      return;
    }

    setBusy(true);
    const res = await payBookingWithIyzicoAction({
      bookingId,
      card: {
        cardHolderName: cardHolder.trim(),
        cardNumber: stripped,
        expireMonth: expMonth.padStart(2, "0"),
        expireYear,
        cvc: cvv,
      },
    });
    setBusy(false);

    if (res.success) {
      router.push(`/bookings/${bookingId}`);
      router.refresh();
      return;
    }

    const key = res.errorKey;
    let msg: string;
    if (key.startsWith("Errors.")) {
      msg = tErr(key.slice(7) as never);
    } else if (key.startsWith("payBooking")) {
      msg = t(key as never);
    } else {
      msg = t("payBookingErrorUnknown");
    }
    if (res.errorDetail && key === "payBookingError_iyzico_failed") {
      msg = `${msg} (${res.errorDetail})`;
    }
    setError(msg);
  };

  return (
    <div className="mx-auto flex min-h-screen max-w-md flex-col gap-6 px-6 pt-28 pb-20 font-sans">
      <Link
        href={`/bookings/${bookingId}`}
        className="inline-flex items-center gap-2 text-xs font-black uppercase tracking-widest text-gray-400 hover:text-orange-600"
      >
        <ChevronLeft size={16} aria-hidden />
        {t("payBookingBack")}
      </Link>

      <div>
        <h1 className="text-2xl font-black text-gray-900">{t("payBookingTitle")}</h1>
        <p className="mt-2 text-sm font-medium text-gray-500">
          {t("payBookingIyzicoSubtitle")}
        </p>
      </div>

      <div className="rounded-2xl border border-gray-100 bg-white p-6 shadow-sm">
        <p className="text-[10px] font-black uppercase tracking-widest text-gray-400">
          {shopName}
        </p>
        <p className="mt-2 text-2xl font-black text-orange-600">{formattedTotal}</p>
      </div>

      <form onSubmit={(e) => void handleSubmit(e)} className="flex flex-col gap-4">
        <div className="relative">
          <User
            className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-300"
            size={18}
          />
          <input
            type="text"
            autoComplete="cc-name"
            placeholder={t("checkoutCardHolderPlaceholder")}
            value={cardHolder}
            onChange={(e) => setCardHolder(e.target.value)}
            className="w-full rounded-2xl border border-gray-100 bg-gray-50 p-4 pl-12 text-sm font-medium outline-none focus:ring-2 focus:ring-orange-500"
          />
        </div>
        <div className="relative">
          <CreditCard
            className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-300"
            size={18}
          />
          <input
            type="text"
            inputMode="numeric"
            autoComplete="cc-number"
            placeholder={t("checkoutCardNumberPlaceholder")}
            maxLength={19}
            value={cardNumber}
            onChange={handleCardNumberChange}
            className="w-full rounded-2xl border border-gray-100 bg-gray-50 p-4 pl-12 text-sm font-medium outline-none focus:ring-2 focus:ring-orange-500"
          />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div className="relative">
            <input
              type="text"
              inputMode="numeric"
              autoComplete="cc-exp"
              placeholder={t("checkoutExpiryPlaceholder")}
              maxLength={5}
              value={expiry}
              onChange={handleExpiryChange}
              className="w-full rounded-2xl border border-gray-100 bg-gray-50 p-4 text-sm font-medium outline-none focus:ring-2 focus:ring-orange-500"
            />
          </div>
          <div className="relative">
            <Lock
              className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-300"
              size={18}
            />
            <input
              type="text"
              inputMode="numeric"
              autoComplete="cc-csc"
              placeholder={t("checkoutCvvPlaceholder")}
              maxLength={4}
              value={cvv}
              onChange={(e) => setCvv(e.target.value.replace(/\D/g, "").slice(0, 4))}
              className="w-full rounded-2xl border border-gray-100 bg-gray-50 p-4 pl-12 text-sm font-medium outline-none focus:ring-2 focus:ring-orange-500"
            />
          </div>
        </div>

        {error ? (
          <div className="flex items-start gap-2 rounded-2xl border border-red-100 bg-red-50 p-4 text-xs font-bold text-red-600">
            <AlertCircle size={16} className="mt-0.5 shrink-0" />
            <span>{error}</span>
          </div>
        ) : null}

        <button
          type="submit"
          disabled={busy}
          className="flex w-full items-center justify-center gap-2 rounded-2xl bg-orange-600 py-4 text-xs font-black uppercase tracking-widest text-white shadow-lg shadow-orange-200 transition-colors hover:bg-orange-700 disabled:opacity-60"
        >
          {busy ? <Loader2 className="h-5 w-5 animate-spin" /> : null}
          {t("payBookingSubmit")}
        </button>
      </form>

      <p className="text-center text-[10px] font-medium uppercase tracking-widest text-gray-400">
        {t("payBookingIyzicoSecureNote")}
      </p>
    </div>
  );
}
