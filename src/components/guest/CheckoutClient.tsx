"use client";

import { Fragment, useState } from "react";
import { useTranslations } from "next-intl";
import QRCode from "qrcode";
import {
  ChevronLeft,
  ShieldCheck,
  CreditCard,
  CheckCircle2,
  QrCode,
  AlertCircle,
  Calendar,
  Lock,
  User,
  Minus,
  Plus,
} from "lucide-react";
import { Link } from "@/i18n/routing";
import BagSelector from "@/components/guest/BagSelector";
import { createBookingAction } from "@/actions/booking";
import {
  computeDailyBagLineTotal,
  computeServiceTotalForStay,
  roundedSlotPrices,
} from "@/lib/bag-pricing";
import type { PricingRules } from "@/lib/pricing-rules";

const STEPS = 3 as const;

interface CheckoutClientProps {
  shopId: string;
  shopName: string;
  shopAddress: string;
  pricePerDay: number;
  pricingRules: PricingRules;
}

export default function CheckoutClient({
  shopId,
  shopName,
  shopAddress,
  pricePerDay,
  pricingRules,
}: CheckoutClientProps) {
  const t = useTranslations("Guest");

  const slot = roundedSlotPrices(pricePerDay, pricingRules);
  const priceS = slot.s;
  const priceM = slot.m;
  const priceXl = slot.xl;

  const [step, setStep] = useState(1);

  const [bagS, setBagS] = useState(0);
  const [bagM, setBagM] = useState(1);
  const [bagXl, setBagXl] = useState(0);
  const [numberOfDays, setNumberOfDays] = useState(1);

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

  const dailyLine = computeDailyBagLineTotal(
    pricePerDay,
    bagS,
    bagM,
    bagXl,
    pricingRules
  );
  const totalPrice = computeServiceTotalForStay(
    pricePerDay,
    bagS,
    bagM,
    bagXl,
    numberOfDays,
    pricingRules
  );
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
    const strippedCard = cardNumber.replace(/\s/g, "");
    const [expMonth, expYear] = expiry.split("/");
    
    if (
      !cardHolder.trim() || 
      strippedCard.length < 16 || 
      !expMonth || 
      !expYear || 
      expYear.length !== 2 || 
      cvv.length < 3
    ) {
      setError(t("checkoutCardValidationError"));
      return;
    }

    setIsProcessing(true);
    setError(null);



    const checkInTime = new Date();
    const checkOutTime = new Date(
      checkInTime.getTime() + numberOfDays * 24 * 60 * 60 * 1000
    );

    const result = await createBookingAction({
      shopId,
      bagCountS: bagS,
      bagCountM: bagM,
      bagCountXl: bagXl,
      unitPrice: pricePerDay,
      totalPrice: grandTotal,
      insuranceFee,
      checkInTime,
      checkOutTime,
      cardInfo: {
        cardHolderName: cardHolder,
        cardNumber: cardNumber.replace(/\s/g, ""),
        expireMonth: expMonth || "12",
        expireYear: expYear ? `20${expYear}` : "2025",
        cvc: cvv,
      },
      couponCode: couponCode.trim() || undefined,
    });

    setIsProcessing(false);

    if (result.success && result.bookingId) {
      setBookingId(result.bookingId);
      if ("qrCodeToken" in result && result.qrCodeToken) {
        QRCode.toDataURL(result.qrCodeToken, { width: 220, margin: 2 })
          .then(setQrDataUrl)
          .catch(() => setQrDataUrl(null));
      }
      setIsSuccess(true);
    } else {
      setError(result.error || t("checkoutUnexpectedError"));
    }
  };

  const goNext = () => {
    setError(null);
    if (step === 1) {
      if (totalPrice === 0 || totalBags === 0) {
        setError(t("checkoutSelectBagsHint"));
        return;
      }
      setStep(2);
      return;
    }
    if (step === 2) {
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
    t("checkoutStep3Short"),
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
              {t("bookingSuccess")}
            </h1>
            <p className="text-green-50/80 font-medium">{t("showToPartner")}</p>
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
                    className={`text-[9px] font-black uppercase tracking-tighter text-center truncate w-full ${
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

      <main className="flex-1 max-w-2xl mx-auto w-full p-6 flex flex-col gap-8 pb-40">
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
              <div className="flex items-center justify-between p-4 bg-gray-50 rounded-2xl border border-gray-100 group hover:border-orange-200 transition-all">
                <div className="flex items-center gap-4">
                  <div className="bg-white p-3 rounded-xl shadow-sm text-gray-400 group-hover:text-orange-600 transition-colors">
                    <Calendar size={24} strokeWidth={1.5} />
                  </div>
                  <div>
                    <p className="font-bold text-gray-900 text-sm">
                      {numberOfDays} {t("daysUnit")}
                    </p>
                    <p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest">
                      {t("dailyRate", { amount: dailyLine })}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  <button
                    type="button"
                    data-testid="checkout-stay-days-decrease"
                    onClick={() => setNumberOfDays((d) => Math.max(1, d - 1))}
                    disabled={numberOfDays <= 1}
                    aria-label="Decrease days"
                    className="w-10 h-10 rounded-full bg-white border border-gray-200 flex items-center justify-center text-gray-900 hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed transition-all active:scale-95 shadow-sm"
                  >
                    <Minus size={18} />
                  </button>
                  <span
                    data-testid="checkout-stay-days-value"
                    className="w-8 text-center font-black text-lg text-gray-900"
                  >
                    {numberOfDays}
                  </span>
                  <button
                    type="button"
                    data-testid="checkout-stay-days-increase"
                    onClick={() =>
                      setNumberOfDays((d) =>
                        Math.min(pricingRules.maxStayDays, d + 1)
                      )
                    }
                    disabled={numberOfDays >= pricingRules.maxStayDays}
                    aria-label="Increase days"
                    className="w-10 h-10 rounded-full bg-orange-600 flex items-center justify-center text-white hover:bg-orange-700 transition-all active:scale-95 shadow-md shadow-orange-200 disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    <Plus size={18} />
                  </button>
                </div>
              </div>
              <p className="text-xs text-gray-400 leading-relaxed">{t("stayDaysHint")}</p>
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

            <div className="bg-green-50 border border-green-100 p-5 rounded-3xl flex items-start gap-4">
              <div className="bg-green-600 p-2 rounded-xl text-white shrink-0">
                <ShieldCheck size={24} />
              </div>
              <div>
                <h4 className="font-bold text-green-900 text-sm">
                  {t("insuranceIncluded")}
                </h4>
                <p className="text-green-700 text-xs leading-relaxed mt-1">
                  {t("checkoutInsuranceDetailBody")}
                </p>
              </div>
            </div>

            <section className="flex flex-col gap-4">
              <div className="flex justify-between items-start text-sm">
                <div className="flex flex-col gap-0.5">
                  <span className="text-gray-400 font-medium">
                    {t("checkoutServiceFee")}
                  </span>
                  {numberOfDays > 1 && (
                    <span className="text-[10px] text-gray-400">
                      ₺{dailyLine} × {numberOfDays} {t("daysUnit")}
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
              {t("checkoutStep3Title")}
            </h2>

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

            <div className="flex justify-between items-baseline bg-gray-50 rounded-2xl px-4 py-3">
              <span className="text-sm font-bold text-gray-600">{t("total")}</span>
              <span className="text-xl font-black text-orange-600">₺{grandTotal}</span>
            </div>

            {error && (
              <div
                data-testid="checkout-payment-error"
                className="bg-red-50 text-red-600 p-4 rounded-2xl text-xs font-bold flex items-center gap-2 border border-red-100 animate-in fade-in slide-in-from-bottom-2"
              >
                <AlertCircle size={16} />
                {error}
              </div>
            )}
          </>
        )}
      </main>

      <footer className="fixed bottom-0 left-1/2 -translate-x-1/2 max-w-2xl w-full p-6 bg-white/90 backdrop-blur-xl border-t border-gray-50 flex flex-col gap-3 z-20">
        {step === 1 && error && (
          <div className="bg-red-50 text-red-600 p-3 rounded-xl text-xs font-bold flex items-center gap-2 border border-red-100">
            <AlertCircle size={14} />
            {error}
          </div>
        )}
        <div className="flex gap-3">
          {step > 1 && (
            <button
              type="button"
              onClick={goBack}
              className="flex-1 py-4 rounded-3xl font-black text-sm uppercase tracking-wider bg-gray-100 text-gray-800 hover:bg-gray-200 transition-colors"
            >
              {t("checkoutBack")}
            </button>
          )}
          {step < 3 ? (
            <button
              type="button"
              data-testid="checkout-footer-primary"
              onClick={goNext}
              disabled={step === 1 && totalPrice === 0}
              className="flex-1 bg-gray-900 hover:bg-gray-800 disabled:bg-gray-200 disabled:cursor-not-allowed text-white py-4 rounded-3xl font-black text-sm uppercase tracking-wider transition-all active:scale-[0.98] shadow-xl shadow-gray-200"
            >
              {step === 1 ? t("checkoutContinue") : t("checkoutToPayment")}
            </button>
          ) : (
            <button
              type="button"
              data-testid="checkout-footer-primary"
              onClick={() => void handlePayment()}
              disabled={totalPrice === 0 || isProcessing}
              className="flex-1 bg-gray-900 hover:bg-gray-800 disabled:bg-gray-200 disabled:cursor-not-allowed text-white py-5 rounded-3xl font-black flex items-center justify-center gap-3 transition-all active:scale-[0.98] shadow-xl shadow-gray-200"
            >
              {isProcessing ? (
                <div className="w-5 h-5 border-2 border-white/20 border-t-white rounded-full animate-spin"></div>
              ) : (
                <CreditCard size={20} />
              )}
              {t("payAndBook")}
            </button>
          )}
        </div>
      </footer>
    </div>
  );
}
