"use client";

import { Fragment, useEffect, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import QRCode from "qrcode";
import {
  ChevronLeft,
  CheckCircle2,
  QrCode,
  AlertCircle,
  MapPin,
  User,
} from "lucide-react";
import { Link } from "@/i18n/routing";
import BagSelector from "@/components/guest/BagSelector";
import BagProtection from "@/components/guest/BagProtection";
import BagSizeGuide from "@/components/guest/BagSizeGuide";
import CheckoutWhatIsIncluded from "@/components/guest/CheckoutWhatIsIncluded";
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
import { useKeyboardAware } from "@/lib/hooks/useKeyboardAware";
import { useShare } from "@/lib/hooks/useShare";
import WebPushOptIn from "@/components/WebPushOptIn";
import SlotAvailabilityGrid from "@/components/guest/SlotAvailabilityGrid";
interface CheckoutClientProps {
  shopId: string;
  shopName: string;
  shopAddress: string;
  pricePerDay: number;
  pricingRules: PricingRules;
  isLoggedIn?: boolean;
  initialCheckIn?: string;
  initialCheckOut?: string;
  initialBags?: number;
}

export default function CheckoutClient({
  shopId,
  shopName,
  shopAddress,
  pricePerDay,
  pricingRules,
  isLoggedIn = false,
  initialCheckIn,
  initialCheckOut,
  initialBags,
}: CheckoutClientProps) {
  const t = useTranslations("Guest");
  const tErr = useTranslations("Errors");
  const locale = useLocale();
  const { keyboardHeight } = useKeyboardAware();
  const { share } = useShare();
  const shareUrl = typeof window !== "undefined" ? window.location.href : "";
  const [selectedSlotCount, setSelectedSlotCount] = useState(0);
  const slot = roundedSlotPrices(pricePerDay, pricingRules);
  const priceS = slot.s;
  const priceM = slot.m;
  const priceXl = slot.xl;

  const [step, setStep] = useState(1);
  const [showAuthModal, setShowAuthModal] = useState(false);

  const [bagS, setBagS] = useState(0);
  const [bagM, setBagM] = useState(initialBags ?? 1);
  const [bagXl, setBagXl] = useState(0);

  const [checkInLocal, setCheckInLocal] = useState(() => {
    if (initialCheckIn && !isNaN(Date.parse(initialCheckIn))) {
      return toDatetimeLocalValue(new Date(initialCheckIn));
    }
    return toDatetimeLocalValue(new Date());
  });
  const [checkOutLocal, setCheckOutLocal] = useState(() => {
    if (initialCheckOut && !isNaN(Date.parse(initialCheckOut))) {
      return toDatetimeLocalValue(new Date(initialCheckOut));
    }
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

  const [isProcessing, setIsProcessing] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [bookingId, setBookingId] = useState("");
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  const [couponCode, setCouponCode] = useState("");
  const [guestEmail, setGuestEmail] = useState("");
  const [guestPhone, setGuestPhone] = useState("");

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

  const handleBooking = async (skipAuthCheck = false) => {
    if (!isLoggedIn && !skipAuthCheck) {
      setShowAuthModal(true);
      return;
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
      couponCode: couponCode.trim() || undefined,
      guestEmail: !isLoggedIn ? (guestEmail.trim() || undefined) : undefined,
      guestPhone: !isLoggedIn ? (guestPhone.trim() || undefined) : undefined,
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
      void handleBooking(true);
    }
  };

  const goBack = () => {
    setError(null);
    if (step > 1) setStep((s) => s - 1);
  };

  const totalSteps = 2;
  const stepLabels = [t("checkoutStep1Short"), t("checkoutStep2Short")];
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

          <div className="w-full max-w-sm">
            <WebPushOptIn />
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

          <div className="flex flex-wrap items-center justify-center gap-3">
            <a
              href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(shopAddress)}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 rounded-xl bg-white px-4 py-3 text-sm font-black text-green-700"
            >
              <MapPin size={16} />
              {t("getDirections")}
            </a>
            <Link
              href="/bookings/lookup"
              className="rounded-xl border border-white/30 px-4 py-3 text-sm font-black text-white transition-colors hover:bg-white/10"
            >
              {t("checkoutManageBooking")}
            </Link>
            <Link
              href="/bookings"
              className="rounded-xl border border-white/30 px-4 py-3 text-sm font-black text-white transition-colors hover:bg-white/10"
            >
              {t("myBookings")}
            </Link>
          </div>

          <p className="text-xs text-white/50 max-w-[280px] text-center">
            {t("checkoutFreeCancelUntilDropOff")}
          </p>
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
                {i < totalSteps - 1 && (
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
              <h2 className="text-sm font-black uppercase tracking-widest text-gray-900">
                {t("stayDuration")}
              </h2>

              <SlotAvailabilityGrid
                shopId={shopId}
                date={checkInDate ?? new Date()}
                selectedBags={totalBags || 1}
                onSelectRange={(from, to, count) => {
                  setSelectedSlotCount(count);
                  if (from) setCheckInLocal(from);
                  if (to) setCheckOutLocal(to);
                }}
              />

              {selectedSlotCount > 0 && (
                <div className="flex items-center justify-between p-4 bg-orange-50 rounded-2xl border border-orange-100">
                  <div>
                    <p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest">
                      {t("checkoutSelectedDuration")}
                    </p>
                    <p className="font-black text-lg text-gray-900 mt-0.5">
                      {selectedSlotCount} {t("checkoutSlotUnit")} ({selectedSlotCount * 0.5}{t("checkoutHourShort")})
                    </p>
                  </div>
                </div>
              )}

              {!windowOk ? (
                <p className="text-xs font-bold text-orange-600">
                  {t("checkoutDatesInvalid", { max: pricingRules.maxStayDays })}
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

            <div className="rounded-2xl border border-emerald-100 bg-emerald-50 p-4 text-xs leading-relaxed text-emerald-800 flex items-center gap-2">
              <span className="text-emerald-600 font-black text-base">✓</span>
              <span className="font-semibold">{t("freeCancellationNote")}</span>
            </div>

            <CheckoutWhatIsIncluded />

            <BagSizeGuide />

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

      </main>

      {/* 2026-08-21: pb 4.5rem (72px) mobil alt navigasyonun gercek yuksekliginden
          (~80px, Playwright ile olculdu) kucuktu -> CTA nav'in ustune biniyordu
          (UX_AUDIT_BOUNCE_COMPARISON P0). 6rem'e cikarildi, ~16px pay birakiyor. */}
      <footer style={{ bottom: keyboardHeight }} className="fixed bottom-0 left-1/2 -translate-x-1/2 max-w-2xl w-full p-4 sm:p-6 pb-[calc(env(safe-area-inset-bottom)+6rem)] bg-white/90 backdrop-blur-xl border-t border-gray-50 flex flex-col gap-3 z-20">
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
          {step < totalSteps ? (
            <button
              type="button"
              data-testid="checkout-footer-primary"
              onClick={goNext}
              disabled={
                step === 1 && (!windowOk || totalPrice === 0)
              }
              className="btn-ui btn-ui-lg btn-ui-primary flex-1 rounded-3xl bg-gray-900 hover:bg-gray-800 shadow-xl shadow-gray-200"
            >
              {step === 1 ? t("checkoutContinue") : t("sendRequest")}
            </button>
          ) : (
            <button
              type="button"
              data-testid="checkout-footer-primary"
              onClick={() => void handleBooking()}
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
              {t("checkoutContinueWithoutAccount")}
            </h3>
            
            <p className="text-sm font-semibold text-gray-500 leading-relaxed mb-6">
              {t("checkoutGuestContactHint")}
            </p>

            {/* Guest Checkout Fields */}
            <div className="flex flex-col gap-3 mb-4">
              <input
                type="email"
                inputMode="email"
                autoComplete="email"
                placeholder={t("checkoutGuestEmailPlaceholder")}
                value={guestEmail}
                onChange={(e) => setGuestEmail(e.target.value)}
                className="w-full bg-gray-50 border border-gray-100 p-4 rounded-2xl text-[16px] font-medium focus:ring-2 focus:ring-orange-500 outline-none transition-all"
              />
              <input
                type="tel"
                inputMode="tel"
                autoComplete="tel"
                placeholder={t("checkoutGuestPhonePlaceholder")}
                value={guestPhone}
                onChange={(e) => setGuestPhone(e.target.value)}
                className="w-full bg-gray-50 border border-gray-100 p-4 rounded-2xl text-[16px] font-medium focus:ring-2 focus:ring-orange-500 outline-none transition-all"
              />
            </div>

            <div className="flex flex-col gap-3">
              <button
                type="button"
                onClick={() => {
                  const email = guestEmail.trim();
                  const phone = guestPhone.trim();
                  if (!email && !phone) {
                    setError(t("checkoutGuestContactRequired"));
                    return;
                  }
                  setShowAuthModal(false);
                  void handleBooking(true);
                }}
                className="w-full bg-orange-600 hover:bg-orange-700 text-white py-4 px-6 rounded-2xl font-bold transition-all shadow-lg shadow-orange-200 hover:bg-orange-300 text-center block cursor-pointer"
              >
                {t("checkoutGuestContinue")}
              </button>
              <div className="relative my-2">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-gray-200" />
                </div>
                <div className="relative flex justify-center text-xs uppercase">
                  <span className="bg-white px-3 text-gray-400 font-bold">
                    {t("checkoutOrWithAccount")}
                  </span>
                </div>
              </div>
              <div className="flex gap-2">
                <Link
                  href={`/login?callbackUrl=/checkout/${shopId}`}
                  className="flex-1 bg-gray-50 hover:bg-gray-100 text-gray-700 py-3 px-4 rounded-2xl font-bold text-xs text-center transition-all"
                >
                  {t("authModalLogin")}
                </Link>
                <Link
                  href={`/register?callbackUrl=/checkout/${shopId}`}
                  className="flex-1 bg-gray-50 hover:bg-gray-100 text-gray-700 py-3 px-4 rounded-2xl font-bold text-xs text-center transition-all"
                >
                  {t("authModalRegister")}
                </Link>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
