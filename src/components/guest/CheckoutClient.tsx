"use client";

import { Fragment, useEffect, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import QRCode from "qrcode";
import {
  ChevronLeft,
  CreditCard,
  CheckCircle2,
  QrCode,
  AlertCircle,
  Calendar,
  Lock,
  User,
} from "lucide-react";
import { Link } from "@/i18n/routing";
import BagSelector from "@/components/guest/BagSelector";
import BagProtection from "@/components/guest/BagProtection";
import { createBookingAction } from "@/actions/booking";
import {
  computeDailyBagLineTotal,
  computeServiceTotalForStay,
  roundedSlotPrices,
} from "@/lib/bag-pricing";
import {
  computeStayDaysFromWindow,
  validateBookingStayWindow,
} from "@/lib/booking-server-price";
import { parseDatetimeLocal, toDatetimeLocalValue } from "@/lib/datetime-local";
import DateTimePicker from "@/components/ui/DateTimePicker";
import type { PricingRules } from "@/lib/pricing-rules";
import {
  PLAUSIBLE_EVENTS,
  trackPlausibleEvent,
} from "@/lib/plausible-events";

const STEPS = 3 as const;

interface CheckoutClientProps {
  shopId: string;
  shopName: string;
  shopAddress: string;
  pricePerDay: number;
  pricingRules: PricingRules;
  paymentsEnabled?: boolean;
  isLoggedIn?: boolean;
}

export default function CheckoutClient({
  shopId,
  shopName,
  shopAddress,
  pricePerDay,
  pricingRules,
  paymentsEnabled = true,
  isLoggedIn = false,
}: CheckoutClientProps) {
  const t = useTranslations("Guest");
  const tErr = useTranslations("Errors");
  const locale = useLocale();
  const slot = roundedSlotPrices(pricePerDay, pricingRules);
  const priceS = slot.s;
  const priceM = slot.m;
  const priceXl = slot.xl;

  const [step, setStep] = useState(1);
  const [showAuthModal, setShowAuthModal] = useState(false);

  const [bagS, setBagS] = useState(0);
  const [bagM, setBagM] = useState(1);
  const [bagXl, setBagXl] = useState(0);

  const [checkInLocal, setCheckInLocal] = useState(() =>
    toDatetimeLocalValue(new Date()),
  );
  const [checkOutLocal, setCheckOutLocal] = useState(() => {
    const now = new Date();
    const defaultOut = new Date(now.getTime() + 24 * 60 * 60 * 1000);
    return toDatetimeLocalValue(defaultOut);
  });

  useEffect(() => {
    trackPlausibleEvent(PLAUSIBLE_EVENTS.CheckoutStarted, { shopId });
  }, [shopId]);

  const checkInDate = parseDatetimeLocal(checkInLocal);
  const checkOutDate = parseDatetimeLocal(checkOutLocal);
  const windowOk =
    checkInDate !== null &&
    checkOutDate !== null &&
    validateBookingStayWindow(checkInDate, checkOutDate, pricingRules);

  const billableDays =
    checkInDate && checkOutDate
      ? computeStayDaysFromWindow(checkInDate, checkOutDate, pricingRules)
      : 1;
  const displayBillableDays = windowOk ? billableDays : null;

  const [cardHolder, setCardHolder] = useState("");
  const [cardNumber, setCardNumber] = useState("");
  const [expiry, setExpiry] = useState("");
  const [cvv, setCvv] = useState("");

  const [isProcessing, setIsProcessing] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [bookingId, setBookingId] = useState("");
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  const [couponCode, setCouponCode] = useState("");

  // Restore draft from localStorage on mount
  useEffect(() => {
    const saved = localStorage.getItem(`bagajpark_checkout_draft_${shopId}`);
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        setTimeout(() => {
          if (parsed.bagS !== undefined) setBagS(parsed.bagS);
          if (parsed.bagM !== undefined) setBagM(parsed.bagM);
          if (parsed.bagXl !== undefined) setBagXl(parsed.bagXl);
          if (parsed.checkInLocal !== undefined) setCheckInLocal(parsed.checkInLocal);
          if (parsed.checkOutLocal !== undefined) setCheckOutLocal(parsed.checkOutLocal);
          if (parsed.couponCode !== undefined) setCouponCode(parsed.couponCode);
        }, 0);
      } catch (e) {
        console.error("Failed to parse saved checkout draft", e);
      }
    }
  }, [shopId]);

  // Save draft to localStorage when inputs change
  useEffect(() => {
    localStorage.setItem(
      `bagajpark_checkout_draft_${shopId}`,
      JSON.stringify({
        bagS,
        bagM,
        bagXl,
        checkInLocal,
        checkOutLocal,
        couponCode,
      })
    );
  }, [shopId, bagS, bagM, bagXl, checkInLocal, checkOutLocal, couponCode]);

  const dailyLine = computeDailyBagLineTotal(
    pricePerDay,
    bagS,
    bagM,
    bagXl,
    pricingRules
  );
  const totalPrice =
    windowOk && checkInDate && checkOutDate
      ? computeServiceTotalForStay(
          pricePerDay,
          bagS,
          bagM,
          bagXl,
          billableDays,
          pricingRules
        )
      : 0;
  const insuranceFee = totalPrice > 0 ? pricingRules.insuranceFeeTry : 0;
  const grandTotal = totalPrice + insuranceFee;

  const totalBags = bagS + bagM + bagXl;

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

  const handleCvvChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value.replace(/\D/g, "");
    setCvv(val.substring(0, 4));
  };

  const handlePayment = async () => {
    if (!isLoggedIn) {
      setShowAuthModal(true);
      return;
    }
    let cardHolderName = cardHolder;
    let cardNumberStripped = cardNumber.replace(/\s/g, "");
    let expMonth = "";
    let expireYear = "";
    let cvc = cvv;

    if (paymentsEnabled) {
      const [expiryMonth, expYearRaw] = expiry.split("/");
      if (
        !cardHolder.trim() ||
        cardNumberStripped.length < 16 ||
        !expiryMonth ||
        !expYearRaw ||
        expYearRaw.replace(/\D/g, "").length < 2 ||
        cvv.length < 3
      ) {
        setError(t("checkoutCardValidationError"));
        return;
      }
      expMonth = expiryMonth;
      const expYearDigits = (expYearRaw ?? "").replace(/\D/g, "").slice(-2);
      expireYear =
        expYearDigits.length === 2
          ? `20${expYearDigits}`
          : new Date().getFullYear().toString();
    } else {
      cardHolderName = "Beta Guest";
      cardNumberStripped = "1111222233334444";
      expMonth = "12";
      expireYear = "2030";
      cvc = "123";
    }

    if (!checkInDate || !checkOutDate || !windowOk) {
      setError(
        t("checkoutDatesInvalid", { max: pricingRules.maxStayDays })
      );
      return;
    }

    setIsProcessing(true);
    setError(null);

    const result = await createBookingAction({
      shopId,
      bagCountS: bagS,
      bagCountM: bagM,
      bagCountXl: bagXl,
      unitPrice: pricePerDay,
      totalPrice: grandTotal,
      insuranceFee,
      checkInTime: checkInDate,
      checkOutTime: checkOutDate,
      cardInfo: {
        cardHolderName,
        cardNumber: cardNumberStripped,
        expireMonth: expMonth || "12",
        expireYear,
        cvc,
      },
      couponCode: couponCode.trim() || undefined,
    });

    setIsProcessing(false);

    if (result.success && result.bookingId) {
      localStorage.removeItem(`bagajpark_checkout_draft_${shopId}`);
      setBookingId(result.bookingId);
      trackPlausibleEvent(PLAUSIBLE_EVENTS.BookingCreated, { shopId });
      if ("qrCodeToken" in result && result.qrCodeToken) {
        QRCode.toDataURL(result.qrCodeToken, { width: 220, margin: 2 })
          .then(setQrDataUrl)
          .catch(() => setQrDataUrl(null));
      }
      setIsSuccess(true);
    } else {
      const code = result.error;
      if (code?.startsWith("Errors.")) {
        const key = code.slice(7);
        setError(tErr(key as never));
      } else {
        setError(code || t("checkoutUnexpectedError"));
      }
    }
  };

  const goNext = () => {
    setError(null);
    if (step === 1) {
      if (!windowOk) {
        setError(
          t("checkoutDatesInvalid", { max: pricingRules.maxStayDays })
        );
        return;
      }
      if (totalPrice === 0 || totalBags === 0) {
        setError(t("checkoutSelectBagsHint"));
        return;
      }
      setStep(2);
      return;
    }
    if (step === 2) {
      if (!isLoggedIn) {
        setShowAuthModal(true);
        return;
      }
      setStep(3);
    }
  };

  const goBack = () => {
    setError(null);
    if (step > 1) setStep((s) => s - 1);
  };

  const stepLabels = [
    t("checkoutStep1Short"),
    t("checkoutStep2Short"),
    paymentsEnabled ? t("checkoutStep3Short") : (locale === "tr" ? "Onay" : "Approval"),
  ];
  if (isSuccess) {
    return (
      <div className="min-h-screen bg-green-600 flex items-center justify-center p-6 text-white text-center">
        <div className="max-w-md w-full flex flex-col items-center gap-8 animate-in fade-in zoom-in duration-500">
          <div className="bg-white/20 p-6 rounded-full">
            <CheckCircle2 size={80} strokeWidth={1.5} />
          </div>
          <div className="flex flex-col gap-2">
            <h1 className="text-3xl font-black tracking-tight">
              {t("requestSent")}
            </h1>
            <p className="text-green-50/80 font-medium">{t("requestSentSub")}</p>
          </div>

          <div className="bg-white text-gray-900 rounded-[2.5rem] p-10 w-full shadow-2xl relative overflow-hidden">
            <div className="absolute top-0 left-0 w-full h-2 bg-orange-600"></div>
            <div className="flex flex-col items-center gap-6">
              <div className="bg-gray-50 border-2 border-gray-100 p-8 rounded-3xl flex items-center justify-center min-h-[220px]">
                {qrDataUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={qrDataUrl} alt="QR" className="w-[220px] h-[220px]" />
                ) : (
                  <QrCode size={180} strokeWidth={1} className="text-gray-900" />
                )}
              </div>
              <div className="flex flex-col gap-1 text-center">
                <p className="text-[10px] text-gray-400 font-bold uppercase tracking-[0.2em]">
                  {t("checkoutReservationIdLabel")}
                </p>
                <p className="text-sm font-black tracking-widest text-gray-900">
                  {bookingId.substring(0, 8).toUpperCase()}
                </p>
              </div>
              <div className="w-full h-px bg-gray-100 my-2"></div>
              <div className="flex flex-col gap-1 w-full text-left">
                <p className="text-[10px] text-gray-400 font-bold uppercase">
                  {t("checkoutDeliveryPointLabel")}
                </p>
                <p className="font-bold text-sm">{shopName}</p>
                <p className="text-xs text-gray-500">{shopAddress}</p>
              </div>
            </div>
          </div>

          <p className="flex flex-wrap items-center justify-center gap-2 text-sm text-white/80">
            <span>{t("checkoutSupportIntro")}</span>
            <Link
              href="/faq"
              className="font-bold text-white underline underline-offset-4 hover:text-white"
            >
              {t("checkoutSupportFaq")}
            </Link>
            <span aria-hidden className="text-white/50">
              ·
            </span>
            <Link
              href="/contact"
              className="font-bold text-white underline underline-offset-4 hover:text-white"
            >
              {t("checkoutSupportContact")}
            </Link>
          </p>

          <Link
            href="/bookings"
            className="text-white/60 text-sm font-bold uppercase tracking-widest hover:text-white transition-colors underline underline-offset-8"
          >
            {t("myBookings")}
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col min-h-screen bg-white text-gray-900">
      <header className="p-6 border-b border-gray-50 flex flex-col gap-4 bg-white sticky top-0 z-10">
        <div className="flex items-center gap-4">
          <Link
            href="/search"
            className="p-2 hover:bg-gray-100 rounded-full transition-colors"
          >
            <ChevronLeft size={24} />
          </Link>
          <h1 className="text-xl font-black tracking-tight">{t("checkout")}</h1>
        </div>

        <p className="flex flex-wrap items-center justify-center gap-2 text-xs text-gray-500">
          <span>{t("checkoutSupportIntro")}</span>
          <Link
            href="/faq"
            className="font-bold text-orange-600 hover:underline"
          >
            {t("checkoutSupportFaq")}
          </Link>
          <span aria-hidden className="text-gray-300">
            ·
          </span>
          <Link
            href="/contact"
            className="font-bold text-orange-600 hover:underline"
          >
            {t("checkoutSupportContact")}
          </Link>
        </p>

        <nav
          className="flex items-center max-w-md mx-auto w-full px-1"
          aria-label="Checkout steps"
        >
          {stepLabels.map((label, i) => {
            const n = i + 1;
            const active = step === n;
            const done = step > n;
            return (
              <Fragment key={n}>
                <div className="flex flex-col items-center gap-1 flex-1 min-w-0">
                  <div
                    className={`w-9 h-9 rounded-full flex items-center justify-center text-xs font-black transition-all shrink-0 ${
                      done
                        ? "bg-green-600 text-white"
                        : active
                          ? "bg-orange-600 text-white ring-4 ring-orange-100"
                          : "bg-gray-100 text-gray-400"
                    }`}
                  >
                    {done ? <CheckCircle2 size={18} /> : n}
                  </div>
                  <span
                    className={`text-[10px] font-black uppercase tracking-tighter text-center truncate w-full ${
                      active ? "text-orange-600" : "text-gray-400"
                    }`}
                  >
                    {label}
                  </span>
                </div>
                {i < STEPS - 1 && (
                  <div
                    className={`h-0.5 flex-1 mb-6 rounded-full min-w-[8px] mx-0.5 ${
                      step > n ? "bg-green-500" : "bg-gray-200"
                    }`}
                  />
                )}
              </Fragment>
            );
          })}
        </nav>
      </header>

      <main className="flex-1 max-w-2xl mx-auto w-full p-4 sm:p-6 flex flex-col gap-8 pb-36 sm:pb-40">
        {step === 1 && (
          <>
            <div>
              <h2 className="text-sm font-black uppercase tracking-widest text-gray-900 mb-4">
                {t("checkoutStep1Title")}
              </h2>
              <div className="flex justify-between items-baseline mb-2">
                <span className="text-xs text-gray-400 font-bold">{shopName}</span>
              </div>
              <div className="flex flex-col gap-4">
                <BagSelector
                  label={t("smallBag")}
                  sublabel={`S / ₺${priceS}`}
                  count={bagS}
                  onIncrease={() => setBagS(bagS + 1)}
                  onDecrease={() => setBagS(Math.max(0, bagS - 1))}
                />
                <BagSelector
                  label={t("mediumBag")}
                  sublabel={`M/L / ₺${priceM}`}
                  count={bagM}
                  onIncrease={() => setBagM(bagM + 1)}
                  onDecrease={() => setBagM(Math.max(0, bagM - 1))}
                />
                <BagSelector
                  label={t("xlBag")}
                  sublabel={`XL / ₺${priceXl}`}
                  count={bagXl}
                  onIncrease={() => setBagXl(bagXl + 1)}
                  onDecrease={() => setBagXl(Math.max(0, bagXl - 1))}
                />
              </div>
            </div>

            <section className="flex flex-col gap-3" data-testid="checkout-stay-days">
              <span data-testid="checkout-dates-ready" className="sr-only">
                ready
              </span>
              <h2 className="text-sm font-black uppercase tracking-widest text-gray-900">
                {t("stayDuration")}
              </h2>
              <p className="text-[11px] text-gray-400 leading-relaxed">
                {locale === "tr"
                  ? "Esnaf müsaitlik kontrolü seçtiğiniz bırakış/alış saatlerine göre yapılır."
                  : "Partner availability is checked against your selected drop-off and pick-up times."}
              </p>
              <div className="flex flex-col gap-3">
                <label className="flex flex-col gap-1.5">
                  <span className="text-[10px] font-black uppercase tracking-widest text-gray-400">
                    {t("checkoutCheckInLabel")}
                  </span>
                  <div className="p-4 bg-gray-50 rounded-2xl border border-gray-100 focus-within:border-orange-200 transition-colors">
                    <DateTimePicker
                      value={checkInLocal}
                      onChange={setCheckInLocal}
                      testId="checkout-checkin"
                      ariaLabel={t("checkoutCheckInLabel")}
                      iconSize={20}
                    />
                  </div>
                </label>
                <label className="flex flex-col gap-1.5">
                  <span className="text-[10px] font-black uppercase tracking-widest text-gray-400">
                    {t("checkoutCheckOutLabel")}
                  </span>
                  <div className="p-4 bg-gray-50 rounded-2xl border border-gray-100 focus-within:border-orange-200 transition-colors">
                    <DateTimePicker
                      value={checkOutLocal}
                      onChange={setCheckOutLocal}
                      testId="checkout-checkout"
                      ariaLabel={t("checkoutCheckOutLabel")}
                      iconSize={20}
                      minDate={parseDatetimeLocal(checkInLocal) ?? undefined}
                    />
                  </div>
                </label>
              </div>
              <div className="flex items-center justify-between p-4 bg-gray-50 rounded-2xl border border-gray-100">
                <div>
                  <p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest">
                    {t("checkoutBillableDaysLabel")}
                  </p>
                  <p className="font-black text-lg text-gray-900 mt-0.5">
                    <span data-testid="checkout-stay-days-value">
                      {displayBillableDays ?? "—"}
                    </span>{" "}
                    {t("daysUnit")}
                  </p>
                </div>
                <p className="text-[10px] text-gray-400 font-bold text-right max-w-[55%] leading-relaxed">
                  {t("dailyRate", { amount: dailyLine })}
                </p>
              </div>
              <p className="text-xs text-gray-400 leading-relaxed">{t("stayDaysHint")}</p>
              {!windowOk ? (
                <p
                  data-testid="checkout-dates-error"
                  className="text-xs font-bold text-orange-600"
                >
                  {t("checkoutDatesInvalid", {
                    max: pricingRules.maxStayDays,
                  })}
                </p>
              ) : null}
            </section>

            <section className="flex flex-col gap-2">
              <label className="text-xs font-black uppercase text-gray-400">
                {t("checkoutCouponOptional")}
              </label>
              <input
                type="text"
                value={couponCode}
                onChange={(e) => setCouponCode(e.target.value)}
                placeholder={t("checkoutCouponPlaceholder")}
                className="w-full bg-gray-50 border border-gray-100 p-4 rounded-2xl text-sm font-semibold uppercase"
              />
            </section>
          </>
        )}

        {step === 2 && (
          <>
            <h2 className="text-sm font-black uppercase tracking-widest text-gray-900">
              {t("checkoutStep2Title")}
            </h2>

            <BagProtection variant="checkout" />

            <section
              className="rounded-2xl border border-gray-100 bg-gray-50/90 p-4 text-xs leading-relaxed text-gray-600"
              aria-labelledby="checkout-policy-callout"
            >
              <p
                id="checkout-policy-callout"
                className="text-[10px] font-black uppercase tracking-widest text-gray-400"
              >
                {t("checkoutPolicyCalloutTitle")}
              </p>
              <p className="mt-2">{t("checkoutPolicyCalloutBody")}</p>
              <Link
                href="/faq"
                className="mt-3 inline-block text-[11px] font-black uppercase tracking-wider text-orange-600 hover:underline"
              >
                {t("checkoutFaqLink")}
              </Link>
            </section>

            <section className="flex flex-col gap-4">
              <div className="flex justify-between items-start text-sm">
                <div className="flex flex-col gap-0.5">
                  <span className="text-gray-400 font-medium">
                    {t("checkoutServiceFee")}
                  </span>
                  {billableDays > 1 && (
                    <span className="text-[10px] text-gray-400">
                      ₺{dailyLine} × {billableDays} {t("daysUnit")}
                    </span>
                  )}
                </div>
                <span className="text-gray-900 font-bold" data-testid="checkout-service-total">
                  ₺{totalPrice}
                </span>
              </div>
              <div className="flex justify-between items-center text-sm">
                <span className="text-gray-400 font-medium">
                  {t("checkoutInsuranceLine")}
                </span>
                <span className="text-gray-900 font-bold">₺{insuranceFee}</span>
              </div>
              <div className="flex justify-between items-baseline pt-4 border-t border-gray-100">
                <span className="text-lg font-black text-gray-900 uppercase tracking-tighter">
                  {t("total")}
                </span>
                <span
                  data-testid="checkout-total-amount"
                  className="text-3xl font-black text-orange-600 tracking-tighter"
                >
                  ₺{grandTotal}
                </span>
              </div>
            </section>
          </>
        )}

        {step === 3 && (
          <>
            <h2 className="text-sm font-black uppercase tracking-widest text-gray-900">
              {paymentsEnabled ? t("checkoutStep3Title") : (locale === "tr" ? "Rezervasyon Onayı" : "Booking Approval")}
            </h2>

            {paymentsEnabled ? (
              <>
                <p className="text-xs leading-relaxed text-gray-500">
                  {t("checkoutPaymentMethodsNote")}
                </p>
                <p className="text-xs font-semibold leading-relaxed text-orange-800/90">
                  {t("checkoutPaymentAfterApprovalNote")}
                </p>
              </>
            ) : (
              <div className="bg-orange-50 border border-orange-100 p-6 rounded-3xl flex flex-col gap-3">
                <p className="text-sm font-black text-orange-800">
                  {locale === "tr" ? "Beta Dönemi: Ücretsiz Rezervasyon" : "Beta Period: Free Reservation"}
                </p>
                <p className="text-xs leading-relaxed text-orange-700 font-medium">
                  {locale === "tr"
                    ? "Beta sürecinde online ödeme alınmamaktadır. Rezervasyon talebiniz onaylandıktan sonra depolama bedelini dükkanda elden nakit olarak veya esnafın POS cihazı üzerinden ödeyebilirsiniz."
                    : "Online payment is disabled during the beta period. After your reservation request is approved, you can pay the storage fee in cash or via the merchant's POS device directly at the shop."}
                </p>
              </div>
            )}

            <section
              className="rounded-2xl border border-gray-100 bg-gray-50/90 p-4 text-xs leading-relaxed text-gray-600"
              aria-labelledby="checkout-policy-callout-pay"
            >
              <p
                id="checkout-policy-callout-pay"
                className="text-[10px] font-black uppercase tracking-widest text-gray-400"
              >
                {t("checkoutPolicyCalloutTitle")}
              </p>
              <p className="mt-2">{t("checkoutPolicyCalloutBody")}</p>
              <Link
                href="/faq"
                className="mt-3 inline-block text-[11px] font-black uppercase tracking-wider text-orange-600 hover:underline"
              >
                {t("checkoutFaqLink")}
              </Link>
            </section>

            <section className="flex flex-col gap-6">
              <h3 className="text-xs font-black uppercase text-gray-400">
                {t("checkoutReviewTitle")}
              </h3>
              <div className="bg-gray-50 p-6 rounded-3xl border border-gray-100 flex flex-col gap-4">
                 <div className="flex justify-between">
                    <span className="text-sm font-bold text-gray-400">{t("totalBags")}</span>
                    <span className="text-sm font-black">{totalBags}</span>
                 </div>
                 <div className="flex justify-between gap-4">
                    <span className="text-sm font-bold text-gray-400 shrink-0">
                      {t("stayDuration")}
                    </span>
                    <span className="text-sm font-black text-right">
                      {checkInLocal && checkOutLocal
                        ? `${checkInLocal.replace("T", " ")} → ${checkOutLocal.replace("T", " ")}`
                        : "—"}
                      <span className="block text-[10px] font-bold text-gray-400 mt-1">
                        {billableDays} {t("daysUnit")}
                      </span>
                    </span>
                 </div>
              </div>
            </section>

            {paymentsEnabled && (
              <section className="flex flex-col gap-6">
                <h3 className="text-xs font-black uppercase text-gray-400">
                  {t("checkoutCardDetails")}
                </h3>

                <div className="flex flex-col gap-4">
                  <div className="relative">
                    <User
                      className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-300"
                      size={18}
                    />
                    <input
                      type="text"
                      placeholder={t("checkoutCardHolderPlaceholder")}
                      value={cardHolder}
                      onChange={(e) => setCardHolder(e.target.value)}
                      className="w-full bg-gray-50 border border-gray-100 p-4 pl-12 rounded-2xl text-sm font-medium focus:ring-2 focus:ring-orange-500 outline-none transition-all"
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
                      placeholder={t("checkoutCardNumberPlaceholder")}
                      maxLength={19}
                      value={cardNumber}
                      onChange={handleCardNumberChange}
                      className="w-full bg-gray-50 border border-gray-100 p-4 pl-12 rounded-2xl text-sm font-medium focus:ring-2 focus:ring-orange-500 outline-none transition-all"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="relative">
                      <Calendar
                        className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-300"
                        size={18}
                      />
                      <input
                        type="text"
                        inputMode="numeric"
                        placeholder={t("checkoutExpiryPlaceholder")}
                        maxLength={5}
                        value={expiry}
                        onChange={handleExpiryChange}
                        className="w-full bg-gray-50 border border-gray-100 p-4 pl-12 rounded-2xl text-sm font-medium focus:ring-2 focus:ring-orange-500 outline-none transition-all"
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
                        placeholder={t("checkoutCvvPlaceholder")}
                        maxLength={4}
                        value={cvv}
                        onChange={handleCvvChange}
                        className="w-full bg-gray-50 border border-gray-100 p-4 pl-12 rounded-2xl text-sm font-medium focus:ring-2 focus:ring-orange-500 outline-none transition-all"
                      />
                    </div>
                  </div>
                </div>
              </section>
            )}

            <div className="flex justify-between items-baseline bg-gray-50 rounded-2xl px-4 py-3">
              <span className="text-sm font-bold text-gray-600">
                {paymentsEnabled ? t("total") : (locale === "tr" ? "Tahmini Tutar" : "Estimated Total")}
              </span>
              <span className="text-xl font-black text-orange-600">₺{grandTotal}</span>
            </div>

            {error && (
              <div
                data-testid="checkout-payment-error"
                className="ui-state ui-state-error flex items-center gap-2 rounded-2xl animate-in fade-in slide-in-from-bottom-2"
              >
                <AlertCircle size={16} />
                {error}
              </div>
            )}
          </>
        )}
      </main>

      <footer className="fixed bottom-0 left-1/2 -translate-x-1/2 max-w-2xl w-full p-4 sm:p-6 pb-safe bg-white/90 backdrop-blur-xl border-t border-gray-50 flex flex-col gap-3 z-20">
        {step === 1 && error && (
          <div className="ui-state ui-state-error flex items-center gap-2 rounded-xl">
            <AlertCircle size={14} />
            {error}
          </div>
        )}
        <div className="flex gap-3">
          {step > 1 && (
            <button
              type="button"
              onClick={goBack}
              className="btn-ui btn-ui-lg btn-ui-ghost flex-1 rounded-3xl"
            >
              {t("checkoutBack")}
            </button>
          )}
          {step < 3 ? (
            <button
              type="button"
              data-testid="checkout-footer-primary"
              onClick={goNext}
              disabled={
                step === 1 && (!windowOk || totalPrice === 0)
              }
              className="btn-ui btn-ui-lg btn-ui-primary flex-1 rounded-3xl bg-gray-900 hover:bg-gray-800 shadow-xl shadow-gray-200"
            >
              {step === 1 ? t("checkoutContinue") : t("checkoutToPayment")}
            </button>
          ) : (
            <button
              type="button"
              data-testid="checkout-footer-primary"
              onClick={() => void handlePayment()}
              disabled={totalPrice === 0 || isProcessing}
              className="btn-ui btn-ui-lg btn-ui-primary flex-1 rounded-3xl bg-gray-900 hover:bg-gray-800 shadow-xl shadow-gray-200"
            >
              {isProcessing ? (
                <div className="w-5 h-5 border-2 border-white/20 border-t-white rounded-full animate-spin"></div>
              ) : (
                <CheckCircle2 size={20} />
              )}
              {t("sendRequest")}
            </button>
          )}
        </div>
      </footer>

      {showAuthModal && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-[100] flex items-center justify-center p-4 animate-fade-in" onClick={() => setShowAuthModal(false)}>
          <div className="relative bg-white rounded-[2rem] shadow-2xl border border-gray-100 max-w-md w-full overflow-hidden p-8 animate-slide-up text-center" onClick={(e) => e.stopPropagation()}>
            <div className="absolute top-0 left-0 right-0 h-2 bg-gradient-to-r from-orange-500 to-amber-500" />
            
            <button
              onClick={() => setShowAuthModal(false)}
              className="absolute top-6 right-6 text-gray-400 hover:text-gray-900 transition-colors p-1.5 rounded-full hover:bg-gray-50 cursor-pointer"
              aria-label="Close"
            >
              <ChevronLeft size={20} className="rotate-180" />
            </button>

            <div className="mx-auto w-12 h-12 bg-orange-50 text-orange-600 rounded-2xl flex items-center justify-center mb-6 border border-orange-100 shadow-md shadow-orange-50">
              <User size={24} />
            </div>

            <h3 className="text-xl font-black text-gray-900 tracking-tight mb-3">
              {t("authModalTitle")}
            </h3>
            
            <p className="text-sm font-semibold text-gray-500 leading-relaxed mb-8">
              {t("authModalBody")}
            </p>

            <div className="flex flex-col gap-3">
              <Link
                href={`/login?callbackUrl=/checkout/${shopId}`}
                className="w-full bg-orange-600 hover:bg-orange-700 text-white py-4 px-6 rounded-2xl font-bold transition-all shadow-lg shadow-orange-200 hover:shadow-orange-300 text-center block cursor-pointer"
              >
                {t("authModalLogin")}
              </Link>
              <Link
                href={`/register?callbackUrl=/checkout/${shopId}`}
                className="w-full bg-gray-50 hover:bg-gray-100 text-gray-700 py-4 px-6 rounded-2xl font-bold transition-all text-center block cursor-pointer"
              >
                {t("authModalRegister")}
              </Link>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
