"use client";

import { useState, useEffect } from 'react';
import { registerGuestAction, registerPartnerApplicationAction } from '@/actions/register';
import { normalizeTrGsm10 } from '@/lib/netgsm';
import dynamic from 'next/dynamic';
import {
  Package,
  ShieldCheck,
  Loader2,
  Mail,
  Lock,
  User,
  ChevronRight,
  Phone,
  Store,
  CheckCircle2
} from 'lucide-react';
import { motion } from 'framer-motion';
import { Link } from '@/i18n/routing';
import { useTranslations } from 'next-intl';
import AmbientBackdrop from "@/components/common/AmbientBackdrop";

const LocationPicker = dynamic(() => import('@/components/partner/LocationPicker'), { ssr: false });

type RegisterType = 'GUEST' | 'PARTNER';

interface LocationState {
  address: string;
  city: string;
  district: string;
  latitude: number | null;
  longitude: number | null;
}

function formatTrMobileInput(input: string): string {
  const digits = input.replace(/\D/g, "").slice(0, 11);
  let normalized = digits;

  // Keep the number in 0XXXXXXXXXX shape while user types.
  if (!normalized.startsWith("0") && normalized.length > 0) {
    normalized = `0${normalized}`.slice(0, 11);
  }

  const p1 = normalized.slice(0, 4);
  const p2 = normalized.slice(4, 7);
  const p3 = normalized.slice(7, 9);
  const p4 = normalized.slice(9, 11);

  return [p1, p2, p3, p4].filter(Boolean).join(" ");
}

export default function RegisterPage() {
  const t = useTranslations('Auth');
  const tCommon = useTranslations('Common');
  const tErrors = useTranslations('Errors');
  const [activeTab, setActiveTab] = useState<RegisterType>('GUEST');
  const [referredByCode, setReferredByCode] = useState<string | undefined>(undefined);

  useEffect(() => {
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      const role = params.get("role");
      if (role?.toLowerCase() === "partner") {
        setActiveTab("PARTNER");
      }
      // Bir esnafın davet linkiyle geldiyse (`/register?role=partner&ref=...`)
      // — bkz. PartnerReferralCard.
      const ref = params.get("ref");
      if (ref) {
        setReferredByCode(ref);
      }
    }
  }, []);

  const [isPending, setIsPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const [guestData, setGuestData] = useState({
    name: '',
    email: '',
    password: '',
  });

  const [partnerData, setPartnerData] = useState({
    name: '',
    phone: '',
    password: '',
    shopName: '',
  });

  const [shopLocation, setShopLocation] = useState<LocationState>({
    address: '',
    city: '',
    district: '',
    latitude: null,
    longitude: null,
  });

  const translateServerError = (code: string | undefined) => {
    if (!code) return t('authErrorGeneric');
    if (code.startsWith('Errors.')) {
      const key = code.slice('Errors.'.length);
      return tErrors(key as Parameters<typeof tErrors>[0]);
    }
    return code;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsPending(true);
    setError(null);

    try {
      if (activeTab === 'GUEST') {
        const res = await registerGuestAction(guestData);
        if (res.success) setSuccess(true);
        else setError(translateServerError(res.error));
      } else {
        const strictPhonePattern = /^05\d{2}\s\d{3}\s\d{2}\s\d{2}$/;
        if (!strictPhonePattern.test(partnerData.phone)) {
          setError(tErrors('invalidTrPhone'));
          return;
        }
        if (!normalizeTrGsm10(partnerData.phone)) {
          setError(tErrors('invalidTrPhone'));
          return;
        }
        if (!shopLocation.city) {
          setError(tErrors("cityRequired"));
          return;
        }
        const fullAddress = [
          shopLocation.address,
          shopLocation.district,
          shopLocation.city,
        ].filter(Boolean).join(', ');

        const res = await registerPartnerApplicationAction({
          ...partnerData,
          shopAddress: fullAddress || shopLocation.city,
          shopCity: shopLocation.city,
          shopDistrict: shopLocation.district,
          shopLatitude: shopLocation.latitude,
          shopLongitude: shopLocation.longitude,
          referredByCode,
        });
        if (res.success) setSuccess(true);
        else setError(translateServerError(res.error));
      }
    } catch {
      setError(t('authErrorGeneric'));
    } finally {
      setIsPending(false);
    }
  };

  if (success) {
    return (
      <div className="relative min-h-screen bg-gray-50 flex flex-col items-center justify-center p-6 font-sans overflow-hidden">
        <AmbientBackdrop />
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="relative z-10 w-full max-w-md bg-white rounded-4xl p-10 shadow-xl shadow-gray-200/50 border border-gray-100 text-center"
        >
          <div className="w-16 h-16 bg-green-100 rounded-2xl flex items-center justify-center mb-8 mx-auto">
            {activeTab === 'GUEST' ? <Mail size={32} className="text-green-600" /> : <CheckCircle2 size={32} className="text-green-600" />}
          </div>
          <h1 className="text-2xl font-black text-gray-900 mb-4">{t('registerSuccessTitle')}</h1>
          <p className="text-gray-500 text-sm font-medium mb-8 leading-relaxed">
            {activeTab === 'GUEST'
              ? t('registerSuccessGuestDesc')
              : t('registerSuccessPartnerDesc')
            }
          </p>
          <Link
            href="/login"
            className="inline-flex items-center justify-center gap-2 text-sm font-bold text-orange-600 hover:text-orange-700 transition-colors"
          >
            {t('backToLogin')} <ChevronRight size={16} />
          </Link>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="relative min-h-screen bg-gray-50 flex flex-col items-center justify-center p-6 font-sans overflow-x-hidden overflow-y-auto pt-20 pb-20">
      <AmbientBackdrop />
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="relative z-10 w-full max-w-md bg-white rounded-4xl p-8 md:p-10 shadow-xl shadow-gray-200/50 border border-gray-100 flex flex-col"
      >
        <div className="flex flex-col items-center mb-8">
          <div className="w-16 h-16 bg-brand-gradient rounded-2xl flex items-center justify-center mb-6 shadow-brand-md">
            <Package size={32} className="text-white" />
          </div>
          <h1 className="text-2xl font-black text-gray-900 mb-2">{t('registerTitle')}</h1>
          <p className="text-gray-400 text-sm font-medium text-center leading-relaxed">
            {t('registerSubtitle')}
          </p>
        </div>

        {/* Tabs */}
        <div className="flex p-1 bg-gray-50 rounded-2xl gap-1 mb-8">
          <button
            onClick={() => setActiveTab('GUEST')}
            className={` flex-1 py-3 id-eyebrow rounded-xl transition-all ${
              activeTab === 'GUEST' ? "bg-white text-orange-600 shadow-sm" : "text-gray-400 hover:text-gray-600"
            }`}
          >
            {tCommon('demoMisafir')}
          </button>
          <button
            onClick={() => setActiveTab('PARTNER')}
            className={` flex-1 py-3 id-eyebrow rounded-xl transition-all ${
              activeTab === 'PARTNER' ? "bg-white text-orange-600 shadow-sm" : "text-gray-400 hover:text-gray-600"
            }`}
          >
            {tCommon('demoEsnaf')}
          </button>
        </div>

        <form onSubmit={handleSubmit} className="w-full flex flex-col gap-4">
          {/* Ad Soyad */}
          <div className="relative">
            <User size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-300 pointer-events-none" />
            <input
              type="text"
              aria-label={t('fullName')}
              placeholder={t('fullName')}
              required
              value={activeTab === 'GUEST' ? guestData.name : partnerData.name}
              onChange={(e) => activeTab === 'GUEST'
                ? setGuestData({ ...guestData, name: e.target.value })
                : setPartnerData({ ...partnerData, name: e.target.value })
              }
              className="w-full h-12 pl-10 pr-4 border-2 border-gray-100 rounded-xl text-sm font-medium text-gray-800 focus:outline-none focus:border-orange-300 transition"
            />
          </div>

          {/* E-posta (misafir) / Telefon (esnaf) */}
          {activeTab === 'GUEST' ? (
            <div className="relative">
              <Mail size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-300 pointer-events-none" />
              <input
                type="email"
                aria-label={t('email')}
                placeholder={t('email')}
                required
                value={guestData.email}
                onChange={(e) => setGuestData({ ...guestData, email: e.target.value })}
                className="w-full h-12 pl-10 pr-4 border-2 border-gray-100 rounded-xl text-sm font-medium text-gray-800 focus:outline-none focus:border-orange-300 transition"
              />
            </div>
          ) : (
            <div className="relative">
              <Phone size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-300 pointer-events-none" />
              <input
                type="tel"
                aria-label={t('phonePlaceholder')}
                placeholder={t('phonePlaceholder')}
                required
                value={partnerData.phone}
                onChange={(e) =>
                  setPartnerData({
                    ...partnerData,
                    phone: formatTrMobileInput(e.target.value),
                  })
                }
                inputMode="numeric"
                autoComplete="tel-national"
                maxLength={14}
                className="w-full h-12 pl-10 pr-4 border-2 border-gray-100 rounded-xl text-sm font-medium text-gray-800 focus:outline-none focus:border-orange-300 transition"
              />
            </div>
          )}

          {/* Şifre */}
          <div className="relative">
            <Lock size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-300 pointer-events-none" />
            <input
              type="password"
              aria-label={t('password')}
              placeholder={t('password')}
              required
              minLength={6}
              value={activeTab === 'GUEST' ? guestData.password : partnerData.password}
              onChange={(e) => activeTab === 'GUEST'
                ? setGuestData({ ...guestData, password: e.target.value })
                : setPartnerData({ ...partnerData, password: e.target.value })
              }
              className="w-full h-12 pl-10 pr-4 border-2 border-gray-100 rounded-xl text-sm font-medium text-gray-800 focus:outline-none focus:border-orange-300 transition"
            />
          </div>

          {/* Esnaf-only alanlar */}
          {activeTab === 'PARTNER' && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              className="flex flex-col gap-4 overflow-hidden"
            >
              {/* İşyeri adı */}
              <div className="relative">
                <Store size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-300 pointer-events-none" />
                <input
                  type="text"
                  aria-label={t('shopName')}
                  placeholder={t('shopName')}
                  required
                  value={partnerData.shopName}
                  onChange={(e) => setPartnerData({ ...partnerData, shopName: e.target.value })}
                  className="w-full h-12 pl-10 pr-4 border-2 border-gray-100 rounded-xl text-sm font-medium text-gray-800 focus:outline-none focus:border-orange-300 transition"
                />
              </div>

              {/* Konum Seçici */}
              <div className="border-2 border-gray-100 rounded-2xl p-4">
                <p className="id-eyebrow text-gray-400 mb-3">
                  {t("registerShopLocation")}
                </p>
                <LocationPicker value={shopLocation} onChange={setShopLocation} />
              </div>
            </motion.div>
          )}

          {error && (
            <p className="text-xs text-red-500 font-semibold text-center mt-2" role="alert">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={isPending}
            className="w-full h-12 bg-orange-600 hover:bg-orange-700 text-white rounded-xl font-bold text-sm transition-all active:scale-95 flex items-center justify-center gap-2 disabled:opacity-60 mt-4"
          >
            {isPending
              ? <Loader2 size={16} className="animate-spin" />
              : (activeTab === 'PARTNER' ? t('registerSubmitPartner') : t('registerSubmitGuest'))
            }
          </button>
        </form>

        <div className="mt-8 pt-8 border-t border-gray-50 w-full text-center">
          <p className="text-sm text-gray-400 font-medium">
            {t('alreadyHaveAccount')}{' '}
            <Link href="/login" className="text-orange-600 font-bold hover:underline">{t('signInEmail')}</Link>
          </p>
        </div>

        <div className="mt-10 w-full flex flex-col items-center gap-0">
          <div className="inline-flex items-center justify-center gap-2 text-green-600 bg-green-50 px-4 py-2.5 rounded-xl border border-green-100 mx-auto">
            <ShieldCheck size={16} className="shrink-0" />
            <span className="id-eyebrow leading-tight">
              {t('secureRegister')}
            </span>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
