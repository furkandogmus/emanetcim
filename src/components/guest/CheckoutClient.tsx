"use client";

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import QRCode from 'qrcode';
import { ChevronLeft, ShieldCheck, CreditCard, CheckCircle2, QrCode, AlertCircle, Calendar, Lock, User, Minus, Plus } from 'lucide-react';
import { Link } from '@/i18n/routing';
import BagSelector from '@/components/guest/BagSelector';
import { createBookingAction } from '@/actions/booking';
import {
  computeDailyBagLineTotal,
  computeServiceTotalForStay,
  roundedSlotPrices,
} from '@/lib/bag-pricing';
import type { PricingRules } from '@/lib/pricing-rules';

interface CheckoutClientProps {
  shopId: string;
  shopName: string;
  shopAddress: string;
  pricePerDay: number;
  pricingRules: PricingRules;
}

export default function CheckoutClient({ shopId, shopName, shopAddress, pricePerDay, pricingRules }: CheckoutClientProps) {
  const t = useTranslations('Guest');

  const slot = roundedSlotPrices(pricePerDay, pricingRules);
  const priceS = slot.s;
  const priceM = slot.m;
  const priceXl = slot.xl;

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

  const dailyLine = computeDailyBagLineTotal(pricePerDay, bagS, bagM, bagXl, pricingRules);
  const totalPrice = computeServiceTotalForStay(
    pricePerDay,
    bagS,
    bagM,
    bagXl,
    numberOfDays,
    pricingRules
  );
  const insuranceFee = totalPrice > 0 ? pricingRules.insuranceFeeTry : 0;

  const handlePayment = async () => {
    if (!cardHolder || cardNumber.length < 16 || !expiry || cvv.length < 3) {
      setError("Lütfen tüm kart bilgilerini eksiksiz doldurun.");
      return;
    }

    setIsProcessing(true);
    setError(null);

    const [expMonth, expYear] = expiry.split('/');

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
      totalPrice: totalPrice + insuranceFee,
      insuranceFee,
      checkInTime,
      checkOutTime,
      cardInfo: {
        cardHolderName: cardHolder,
        cardNumber: cardNumber.replace(/\s/g, ''),
        expireMonth: expMonth || "12",
        expireYear: expYear ? `20${expYear}` : "2025",
        cvc: cvv
      },
      couponCode: couponCode.trim() || undefined,
    });

    setIsProcessing(false);

    if (result.success && result.bookingId) {
      setBookingId(result.bookingId);
      if ("qrCodeToken" in result && result.qrCodeToken) {
        QRCode.toDataURL(result.qrCodeToken, { width: 220, margin: 2 }).then(setQrDataUrl).catch(() => setQrDataUrl(null));
      }
      setIsSuccess(true);
    } else {
      setError(result.error || "Beklenmedik bir hata oluştu.");
    }
  };

  if (isSuccess) {
    return (
      <div className="min-h-screen bg-green-600 flex items-center justify-center p-6 text-white text-center">
        <div className="max-w-md w-full flex flex-col items-center gap-8 animate-in fade-in zoom-in duration-500">
          <div className="bg-white/20 p-6 rounded-full">
            <CheckCircle2 size={80} strokeWidth={1.5} />
          </div>
          <div className="flex flex-col gap-2">
            <h1 className="text-3xl font-black tracking-tight">{t('bookingSuccess')}</h1>
            <p className="text-green-50/80 font-medium">{t('showToPartner')}</p>
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
                <p className="text-[10px] text-gray-400 font-bold uppercase tracking-[0.2em]">RESERVASYON ID</p>
                <p className="text-sm font-black tracking-widest text-gray-900">{bookingId.substring(0, 8).toUpperCase()}</p>
              </div>
              <div className="w-full h-px bg-gray-100 my-2"></div>
              <div className="flex flex-col gap-1 w-full text-left">
                 <p className="text-[10px] text-gray-400 font-bold uppercase">TESLİMAT NOKTASI</p>
                 <p className="font-bold text-sm">{shopName}</p>
                 <p className="text-xs text-gray-500">{shopAddress}</p>
              </div>
            </div>
          </div>

          <Link href="/bookings" className="text-white/60 text-sm font-bold uppercase tracking-widest hover:text-white transition-colors underline underline-offset-8">
            {t('myBookings')}
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col min-h-screen bg-white text-gray-900">
      <header className="p-6 border-b border-gray-50 flex items-center gap-4 bg-white sticky top-0 z-10">
        <Link href="/search" className="p-2 hover:bg-gray-100 rounded-full transition-colors">
          <ChevronLeft size={24} />
        </Link>
        <h1 className="text-xl font-black tracking-tight">{t('checkout')}</h1>
      </header>

      <main className="flex-1 max-w-2xl mx-auto w-full p-6 flex flex-col gap-10 pb-32">
        <section className="flex flex-col gap-4">
          <div className="flex justify-between items-baseline mb-2">
            <h2 className="text-sm font-black uppercase tracking-widest text-gray-900">{t('selectBags')}</h2>
            <span className="text-xs text-gray-400 font-bold">{shopName}</span>
          </div>

          <BagSelector 
            label={t('smallBag')} sublabel={`S / ₺${priceS}`} count={bagS}
            onIncrease={() => setBagS(bagS + 1)} onDecrease={() => setBagS(Math.max(0, bagS - 1))}
          />
          <BagSelector 
            label={t('mediumBag')} sublabel={`M/L / ₺${priceM}`} count={bagM}
            onIncrease={() => setBagM(bagM + 1)} onDecrease={() => setBagM(Math.max(0, bagM - 1))}
          />
          <BagSelector 
            label={t('xlBag')} sublabel={`XL / ₺${priceXl}`} count={bagXl}
            onIncrease={() => setBagXl(bagXl + 1)} onDecrease={() => setBagXl(Math.max(0, bagXl - 1))}
          />
        </section>

        <section className="flex flex-col gap-3" data-testid="checkout-stay-days">
          <div className="flex justify-between items-baseline mb-1">
            <h2 className="text-sm font-black uppercase tracking-widest text-gray-900">{t('stayDuration')}</h2>
          </div>
          <div className="flex items-center justify-between p-4 bg-gray-50 rounded-2xl border border-gray-100 group hover:border-orange-200 transition-all">
            <div className="flex items-center gap-4">
              <div className="bg-white p-3 rounded-xl shadow-sm text-gray-400 group-hover:text-orange-600 transition-colors">
                <Calendar size={24} strokeWidth={1.5} />
              </div>
              <div>
                <p className="font-bold text-gray-900 text-sm">
                  {numberOfDays} {t('daysUnit')}
                </p>
                <p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest">
                  {t('dailyRate', { amount: dailyLine })}
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
                onClick={() => setNumberOfDays((d) => Math.min(pricingRules.maxStayDays, d + 1))}
                disabled={numberOfDays >= pricingRules.maxStayDays}
                aria-label="Increase days"
                className="w-10 h-10 rounded-full bg-orange-600 flex items-center justify-center text-white hover:bg-orange-700 transition-all active:scale-95 shadow-md shadow-orange-200 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <Plus size={18} />
              </button>
            </div>
          </div>
          <p className="text-xs text-gray-400 leading-relaxed">{t('stayDaysHint')}</p>
        </section>

        <section className="flex flex-col gap-2">
          <label className="text-xs font-black uppercase text-gray-400">İndirim kodu (isteğe bağlı)</label>
          <input
            type="text"
            value={couponCode}
            onChange={(e) => setCouponCode(e.target.value)}
            placeholder="Örn: WELCOME10"
            className="w-full bg-gray-50 border border-gray-100 p-4 rounded-2xl text-sm font-semibold uppercase"
          />
        </section>

        <div className="bg-green-50 border border-green-100 p-5 rounded-3xl flex items-start gap-4">
          <div className="bg-green-600 p-2 rounded-xl text-white">
            <ShieldCheck size={24} />
          </div>
          <div>
            <h4 className="font-bold text-green-900 text-sm">{t('insuranceIncluded')}</h4>
            <p className="text-green-700 text-xs leading-relaxed mt-1">Emanet bıraktığınız her valiz anlaşmalı kurumlarca çalınma ve hasara karşı sigortalıdır.</p>
          </div>
        </div>

        <section className="flex flex-col gap-6">
          <h2 className="text-sm font-black uppercase tracking-widest text-gray-900">Kart Bilgileri</h2>

          <div className="flex flex-col gap-4">
             <div className="relative">
                <User className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-300" size={18} />
                <input 
                  type="text" 
                  placeholder="Kart Üzerindeki İsim" 
                  value={cardHolder}
                  onChange={(e) => setCardHolder(e.target.value)}
                  className="w-full bg-gray-50 border border-gray-100 p-4 pl-12 rounded-2xl text-sm font-medium focus:ring-2 focus:ring-orange-500 outline-none transition-all"
                />
             </div>

             <div className="relative">
                <CreditCard className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-300" size={18} />
                <input 
                  type="text" 
                  placeholder="0000 0000 0000 0000" 
                  maxLength={19}
                  value={cardNumber}
                  onChange={(e) => setCardNumber(e.target.value)}
                  className="w-full bg-gray-50 border border-gray-100 p-4 pl-12 rounded-2xl text-sm font-medium focus:ring-2 focus:ring-orange-500 outline-none transition-all"
                />
             </div>

             <div className="grid grid-cols-2 gap-4">
                <div className="relative">
                  <Calendar className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-300" size={18} />
                  <input 
                    type="text" 
                    placeholder="AA/YY" 
                    value={expiry}
                    onChange={(e) => setExpiry(e.target.value)}
                    className="w-full bg-gray-50 border border-gray-100 p-4 pl-12 rounded-2xl text-sm font-medium focus:ring-2 focus:ring-orange-500 outline-none transition-all"
                  />
                </div>
                <div className="relative">
                  <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-300" size={18} />
                  <input 
                    type="text" 
                    placeholder="CVV" 
                    maxLength={3}
                    value={cvv}
                    onChange={(e) => setCvv(e.target.value)}
                    className="w-full bg-gray-50 border border-gray-100 p-4 pl-12 rounded-2xl text-sm font-medium focus:ring-2 focus:ring-orange-500 outline-none transition-all"
                  />
                </div>
             </div>
          </div>
        </section>

        {error && (
          <div
            data-testid="checkout-payment-error"
            className="bg-red-50 text-red-600 p-4 rounded-2xl text-xs font-bold flex items-center gap-2 border border-red-100 animate-in fade-in slide-in-from-bottom-2"
          >
            <AlertCircle size={16} />
            {error}
          </div>
        )}

        <section className="mt-4 pt-10 border-t border-gray-100 flex flex-col gap-4">
           <div className="flex justify-between items-start text-sm">
             <div className="flex flex-col gap-0.5">
               <span className="text-gray-400 font-medium">Hizmet Bedeli</span>
               {numberOfDays > 1 && (
                 <span className="text-[10px] text-gray-400">
                   ₺{dailyLine} × {numberOfDays} {t('daysUnit')}
                 </span>
               )}
             </div>
             <span className="text-gray-900 font-bold" data-testid="checkout-service-total">₺{totalPrice}</span>
           </div>
           <div className="flex justify-between items-center text-sm">
             <span className="text-gray-400 font-medium">Sigorta ve Güvence</span>
             <span className="text-gray-900 font-bold">₺{insuranceFee}</span>
           </div>
           <div className="flex justify-between items-baseline pt-4">
             <span className="text-lg font-black text-gray-900 uppercase tracking-tighter">{t('total')}</span>
             <span
               data-testid="checkout-total-amount"
               className="text-3xl font-black text-orange-600 tracking-tighter cursor-default"
             >
               ₺{totalPrice + insuranceFee}
             </span>
           </div>
        </section>
      </main>

      <footer className="fixed bottom-0 left-1/2 -translate-x-1/2 max-w-2xl w-full p-6 bg-white/80 backdrop-blur-xl border-t border-gray-50 flex flex-col gap-4 z-20">
        <button 
          onClick={handlePayment}
          disabled={totalPrice === 0 || isProcessing}
          className="w-full bg-gray-900 hover:bg-gray-800 disabled:bg-gray-200 disabled:cursor-not-allowed text-white py-5 rounded-3xl font-black flex items-center justify-center gap-3 transition-all active:scale-[0.98] shadow-xl shadow-gray-200"
        >
          {isProcessing ? (
            <div className="w-5 h-5 border-2 border-white/20 border-t-white rounded-full animate-spin"></div>
          ) : (
            <CreditCard size={20} />
          )}
          {t('payAndBook')}
        </button>
      </footer>
    </div>
  );
}
