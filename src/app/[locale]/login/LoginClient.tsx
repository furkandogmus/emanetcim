"use client";

import { useTranslations } from 'next-intl';
import { signIn, getSession } from 'next-auth/react';
import { Link } from '@/i18n/routing';
import { useSearchParams } from 'next/navigation';
import { useMemo, useState, useEffect } from 'react';
import { sanitizeAuthCallbackUrl, withAuthCallback } from '@/lib/auth-callback-url';
import { authErrorMessage } from '@/lib/auth-error-message';
import { resolveLoginLanding } from '@/lib/auth-landing';
import { Package, ShieldCheck, Loader2, Store, Shield, Mail, Lock, ChevronDown } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import AmbientBackdrop from "@/components/common/AmbientBackdrop";
import BrandMark from "@/components/common/BrandMark";
import { useFieldErrors } from "@/lib/hooks/useFieldErrors";

/*
  Apple'in orijinal (isirilmis) logosu: Sign in with Apple yonergeleri dugmede bu logoyu
  ister. lucide'nin `Apple` ikonu genel bir elma cizimi, logo degil.
*/
function AppleLogo({ size = 20, className }: { size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" className={className}>
      <path d="M12.152 6.896c-.948 0-2.415-1.078-3.96-1.04-2.04.027-3.91 1.183-4.961 3.014-2.117 3.675-.546 9.103 1.519 12.09 1.013 1.454 2.208 3.09 3.792 3.039 1.52-.065 2.09-.987 3.935-.987 1.831 0 2.35.987 3.96.948 1.637-.026 2.676-1.48 3.676-2.948 1.156-1.688 1.636-3.325 1.662-3.415-.039-.013-3.182-1.221-3.22-4.857-.026-3.04 2.48-4.494 2.597-4.559-1.429-2.09-3.623-2.324-4.39-2.376-2-.156-3.675 1.09-4.61 1.09zM15.53 3.83c.843-1.012 1.4-2.427 1.245-3.83-1.207.052-2.662.805-3.532 1.818-.78.896-1.454 2.338-1.273 3.714 1.338.104 2.715-.688 3.559-1.701" />
    </svg>
  );
}

function GoogleIcon({ size = 20 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 18 18" aria-hidden="true">
      <path fill="#4285F4" d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844c-.209 1.125-.843 2.078-1.796 2.717v2.259h2.908c1.702-1.567 2.684-3.874 2.684-6.617z" />
      <path fill="#34A853" d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332C2.438 15.983 5.482 18 9 18z" />
      <path fill="#FBBC05" d="M3.964 10.71c-.18-.54-.282-1.117-.282-1.71s.102-1.17.282-1.71V4.958H.957C.347 6.173 0 7.548 0 9s.348 2.827.957 4.042l3.007-2.332z" />
      <path fill="#EA4335" d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0 5.482 0 2.438 2.017.957 4.958L3.964 7.29C4.672 5.163 6.656 3.58 9 3.58z" />
    </svg>
  );
}

/** Seed ile aynı varsayılan; `NEXT_PUBLIC_DEMO_PASSWORD` ile yerelde override edilebilir. */
const DEMO_PASSWORD =
  typeof process.env.NEXT_PUBLIC_DEMO_PASSWORD === "string" &&
  process.env.NEXT_PUBLIC_DEMO_PASSWORD.length > 0
    ? process.env.NEXT_PUBLIC_DEMO_PASSWORD
    : "Demo123!";

type LoginClientProps = {
  showAppleSignIn?: boolean;
  showDemoShortcuts?: boolean;
};

export default function LoginPage({
  showAppleSignIn = false,
  showDemoShortcuts = false,
}: LoginClientProps) {
  const t = useTranslations('Auth');
  const tCommon = useTranslations('Common');
  const searchParams = useSearchParams();
  const rawCallback = searchParams.get('callbackUrl');
  const oauthErrorCode = searchParams.get('error');
  const callbackUrl = useMemo(
    () => sanitizeAuthCallbackUrl(rawCallback),
    [rawCallback],
  );

  const isPartnerCallback = useMemo(() => {
    return !!(callbackUrl && callbackUrl.includes('/partner'));
  }, [callbackUrl]);

  const [activeTab, setActiveTab] = useState<'GUEST' | 'PARTNER'>(
    isPartnerCallback ? 'PARTNER' : 'GUEST'
  );

  useEffect(() => {
    if (rawCallback == null || rawCallback === '') return;
    const cleaned = sanitizeAuthCallbackUrl(rawCallback);
    if (cleaned === rawCallback) return;
    const url = new URL(window.location.href);
    if (cleaned === '/') {
      url.searchParams.delete('callbackUrl');
    } else {
      url.searchParams.set('callbackUrl', cleaned);
    }
    const next = url.pathname + url.search + url.hash;
    window.history.replaceState({}, '', next);
  }, [rawCallback]);

  const [isLoggingIn, setIsLoggingIn] = useState<string | null>(null);
  const [showEmailForm, setShowEmailForm] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [credError, setCredError] = useState('');
  /*
    Ozet (role="alert") ayni zamanda kimlik alaninin hata metni: aria-describedby
    ona baglaniyor, metin iki kez yazilmiyor. Yalnizca hatali kimlik/sifre ALAN
    hatasidir; hiz siniri, yasak, dogrulanmamis e-posta hesabin durumu, girdi
    dogru oldugu halde alani "gecersiz" ilan etmek yaniltirdi.
  */
  const { attachForm, setErrors: setFieldErrors, clearError, fieldProps, errorId } =
    useFieldErrors<'identity'>('login');
  const failCredentials = (message: string, { field }: { field: boolean }) => {
    setCredError(message);
    setFieldErrors(field ? { identity: message } : {});
  };
  const [oauthActionError, setOauthActionError] = useState<string | null>(null);

  const oauthBanner =
    oauthErrorCode != null && oauthErrorCode !== ''
      ? authErrorMessage(t, oauthErrorCode)
      : oauthActionError;

  const handleOAuth = async (provider: string) => {
    setIsLoggingIn(provider);
    setOauthActionError(null);
    try {
      await signIn(provider, { callbackUrl });
    } catch {
      setOauthActionError(t('oauthUnexpectedError'));
      setIsLoggingIn(null);
    }
  };

  const handleCredentials = async (e: React.FormEvent) => {
    e.preventDefault();
    setCredError('');
    setFieldErrors({});
    setIsLoggingIn('credentials');
    try {
      const res = await signIn('credentials', {
        emailOrPhone: email.trim(),
        password,
        callbackUrl,
        redirect: false,
      });
      if (res?.error) {
        // `code`, authorize içindeki CredentialsSignin alt sınıfından gelir.
        if (res.error === "EmailVerificationRequired" || res.code === "EmailVerificationRequired") {
          failCredentials(authErrorMessage(t, "EmailVerificationRequired"), { field: false });
        } else if (res.code === "UserBanned") {
          failCredentials(authErrorMessage(t, "UserBanned"), { field: false });
        } else if (res.code === "tooManyRequests") {
          failCredentials(t("tooManyAttempts"), { field: false });
        } else {
          failCredentials(t('invalidCredentials'), { field: true });
        }
        setIsLoggingIn(null);
      } else if (res?.ok) {
        /**
         * Varış noktası ROLDEN türer, sekmeden değil.
         *
         * Eskiden doğrudan `res.url`'e gidiliyordu; hedef belirtilmemişse bu ana
         * sayfa demekti. Sonuç: e-postayla kayıtlı bir esnaf giriş yapıyor ama
         * esnaf paneline değil misafir ana sayfasına düşüyordu (P1-16).
         *
         * Oturum burada okunuyor çünkü rol yalnızca giriş BAŞARILI olduktan sonra
         * bilinir. Okunamazsa `callbackUrl`'e düşülür — yönlendirme bir kolaylık,
         * girişin kendisi değil, o yüzden hata vermeye değmez.
         */
        let landing = callbackUrl;
        try {
          const session = await getSession();
          landing = resolveLoginLanding(callbackUrl, session?.user?.role);
        } catch {
          // yut: aşağıda callbackUrl ile devam ediyoruz
        }
        window.location.href = landing;
      }
    } catch {
      failCredentials(t('invalidCredentials'), { field: true });
      setIsLoggingIn(null);
    }
  };

  const busy = !!isLoggingIn;

  const renderCredentialsForm = () => (
    <>
      {/* E-posta / Telefon */}
      <div className="flex flex-col gap-1.5">
      <label htmlFor="login-identity" className="text-xs font-bold text-gray-600">
        {t('emailOrPhone')}
      </label>
      <div className="relative">
        <Mail size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-300 pointer-events-none" />
        {/*
          HER İKİ SEKMEDE DE e-posta veya telefon kabul edilir.

          Eskiden ESNAF sekmesi `type=tel` + `inputMode=numeric` idi, yani
          e-postayla kayıtlı bir esnaf kendisi için etiketlenmiş sekmeden GİRİŞ
          YAPAMIYORDU. Çalışan yol "MİSAFİR" yazan sekmeydi (P1-16). Oysa arkada
          tek kimlik sistemi var: `auth.config.ts` → `authorize()` zaten e-posta
          VE telefonu birlikte sorguluyor. Sekme, olmayan bir ayrımı taklit edip
          çalışan bir yolu kapatıyordu; artık yalnızca görsel bir ipucu.
        */}
        {/*
          E-posta VEYA telefon kabul ettigi icin `username` (e-posta degil). Mobil
          klavye ilk harfi buyutup "duzeltince" e-posta eslesmiyordu.
        */}
        <input
          id="login-identity"
          name="username"
          type="text"
          inputMode="text"
          autoComplete="username"
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
          {...fieldProps('identity')}
          value={email}
          onChange={(e) => {
            setEmail(e.target.value);
            clearError('identity');
          }}
          required
          disabled={busy}
          className="w-full h-12 pl-10 pr-4 border-2 border-gray-100 rounded-xl text-sm font-medium text-gray-800 placeholder-gray-300 disabled:opacity-50 transition aria-[invalid=true]:border-red-300"
        />
      </div>
      </div>

      {/* Şifre */}
      <div className="flex flex-col gap-1.5">
      <label htmlFor="login-password" className="text-xs font-bold text-gray-600">
        {t('password')}
      </label>
      <div className="relative">
        <Lock size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-300 pointer-events-none" />
        <input
          id="login-password"
          name="password"
          type="password"
          autoComplete="current-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          disabled={busy}
          className="w-full h-12 pl-10 pr-4 border-2 border-gray-100 rounded-xl text-sm font-medium text-gray-800 placeholder-gray-300 disabled:opacity-50 transition"
        />
      </div>
      </div>

      <div className="flex justify-end">
        <Link
          href="/auth/forgot-password"
          className="text-[11px] id-eyebrow text-orange-600 hover:text-orange-700"
        >
          {t("forgotPasswordLink")}
        </Link>
      </div>

      {/* Hata */}
      {credError && (
        <p id={errorId('identity')} className="text-xs text-red-500 font-semibold text-center" role="alert">
            {credError}
          </p>
      )}

      {/* Giriş butonu */}
      <button
        type="submit"
        disabled={busy}
        className="w-full h-12 bg-orange-600 hover:bg-orange-700 text-white rounded-xl font-bold text-sm transition-all active:scale-95 flex items-center justify-center gap-2 disabled:opacity-60 cursor-pointer"
      >
        {isLoggingIn === 'credentials'
          ? <><Loader2 size={16} className="animate-spin" />{t('signingIn')}</>
          : t('signInEmail')}
      </button>
    </>
  );

  return (
    <div className="relative min-h-screen bg-gray-50 flex flex-col items-center justify-center p-4 sm:p-6 font-sans overflow-hidden">
      {/*
        Ana sayfanin hero'suyla ayni sicak degrade dokusu -- eskiden bu sayfa
        duz gri zemindi, markanin turuncusu hic gorunmuyordu (kullanici
        talebi: "giris sayfasini biraz daha guzellestir").
      */}
      <AmbientBackdrop />

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="relative z-10 w-full max-w-md max-w-[calc(100vw-1rem)] bg-white rounded-3xl sm:rounded-4xl p-6 sm:p-10 shadow-xl shadow-gray-200/50 border border-gray-100 flex flex-col items-center"
      >
        {/* Logo */}
        <BrandMark size={64} className="h-16 w-auto mb-8" />

        <h1 className="text-2xl font-black text-gray-900 mb-2">{t('loginTitle')}</h1>
        <p className="text-gray-400 text-sm font-medium mb-8 text-center leading-relaxed">
          {t('loginSubtitle')}
        </p>

        {/* Tabs */}
        <div className="flex p-1 bg-gray-50 rounded-2xl gap-1 mb-8 w-full">
          <button
            onClick={() => {
              setActiveTab('GUEST');
              setCredError('');
              clearError('identity');
            }}
            className={` flex-1 py-3 id-eyebrow rounded-xl transition-all cursor-pointer ${
              activeTab === 'GUEST' ? "bg-white text-orange-600 shadow-sm" : "text-gray-400 hover:text-gray-600"
            }`}
          >
            {tCommon('demoMisafir')}
          </button>
          <button
            onClick={() => {
              setActiveTab('PARTNER');
              setCredError('');
              clearError('identity');
              setShowEmailForm(true);
            }}
            className={` flex-1 py-3 id-eyebrow rounded-xl transition-all cursor-pointer ${
              activeTab === 'PARTNER' ? "bg-white text-orange-600 shadow-sm" : "text-gray-400 hover:text-gray-600"
            }`}
          >
            {tCommon('demoEsnaf')}
          </button>
        </div>

        {oauthBanner && (
          <p className="w-full text-xs text-red-600 font-semibold text-center mb-4 leading-snug px-1" role="alert">
            {oauthBanner}
          </p>
        )}

        <div className="w-full flex flex-col gap-3">
          {activeTab === 'GUEST' ? (
            <>
              {/* Google */}
              <button
                onClick={() => handleOAuth('google')}
                disabled={busy}
                className="w-full h-14 bg-white border-2 border-gray-100 rounded-2xl flex items-center justify-center gap-3 hover:border-orange-200 transition-all active:scale-95 group disabled:opacity-50 cursor-pointer"
              >
                {isLoggingIn === 'google'
                  ? <Loader2 size={20} className="animate-spin text-orange-600" />
                  : <GoogleIcon size={20} />}
                <span className="font-bold text-gray-900">{t('continueWithGoogle')}</span>
              </button>

              {showAppleSignIn ? (
                <button
                  type="button"
                  onClick={() => handleOAuth('apple')}
                  disabled={busy}
                  className="w-full h-14 bg-gray-900 border-2 border-gray-900 rounded-2xl flex items-center justify-center gap-3 hover:bg-black transition-all active:scale-95 group disabled:opacity-50 cursor-pointer"
                >
                  {isLoggingIn === 'apple' ? (
                    <Loader2 size={20} className="animate-spin text-white" />
                  ) : (
                    <AppleLogo size={20} className="text-white shrink-0" />
                  )}
                  <span className="font-bold text-white">{t('continueWithApple')}</span>
                </button>
              ) : (
                <div className="relative">
                  <div className="w-full h-14 bg-gray-100 rounded-2xl flex items-center justify-center gap-3 cursor-not-allowed opacity-50 select-none">
                    <AppleLogo size={20} className="text-gray-400" />
                    <span className="font-bold text-gray-400">{t('continueWithApple')}</span>
                  </div>
                  <span className="absolute -top-2 -right-2 bg-orange-500 text-white id-eyebrow px-2 py-0.5 rounded-full shadow">
                    {t('comingSoon')}
                  </span>
                </div>
              )}

              {/* Divider */}
              <div className="flex items-center gap-3 my-1">
                <div className="flex-1 h-px bg-gray-100" />
                {/* text-gray-300 beyaz zeminde ~1.5:1 veriyordu (WCAG AA eşiği
                    4.5:1) — aynı kontrast hatası Footer.tsx ve page.tsx'te
                    zaten ölçülüp düzeltilmişti, bu etiket gözden kaçmıştı. */}
                <span className="text-[10px] font-black text-gray-400 uppercase tracking-[0.15em]">{t('orDivider')}</span>
                <div className="flex-1 h-px bg-gray-100" />
              </div>

              {/* E-posta formu toggle */}
              <button
                type="button"
                onClick={() => setShowEmailForm((v) => !v)}
                disabled={busy}
                className="w-full h-14 border-2 border-gray-100 rounded-2xl flex items-center justify-center gap-3 hover:border-orange-200 transition-all group disabled:opacity-50 relative cursor-pointer"
              >
                <Mail size={20} className="text-gray-400 group-hover:text-orange-600 transition-colors" />
                <span className="font-bold text-gray-700">{t('continueWithEmailOrPhone')}</span>
                <div className="absolute right-6 top-1/2 -translate-y-1/2">
                  <ChevronDown
                    size={16}
                    className={`text-gray-300 transition-transform duration-200 ${showEmailForm ? 'rotate-180' : ''}`}
                  />
                </div>
              </button>

              {/* E-posta formu */}
              <AnimatePresence>
                {showEmailForm && (
                  <motion.form
                    key="email-form"
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    transition={{ duration: 0.2 }}
                    ref={attachForm}
                    onSubmit={handleCredentials}
                    className="overflow-hidden w-full flex flex-col gap-3"
                  >
                    {renderCredentialsForm()}
                  </motion.form>
                )}
              </AnimatePresence>
            </>
          ) : (
            <form ref={attachForm} onSubmit={handleCredentials} className="w-full flex flex-col gap-3">
              {renderCredentialsForm()}
            </form>
          )}
        </div>

        {showDemoShortcuts && (
          <>
            <div className="w-full flex items-center gap-3 my-6">
              <div className="flex-1 h-px bg-gray-100" />
              <span className="text-[10px] font-black text-gray-300 uppercase tracking-[0.2em]">{t('demoMode')}</span>
              <div className="flex-1 h-px bg-gray-100" />
            </div>

            <div className="w-full grid grid-cols-1 sm:grid-cols-3 gap-3">
              <button
                type="button"
                onClick={() =>
                  signIn("credentials", {
                    emailOrPhone: "misafir@test.com",
                    password: DEMO_PASSWORD,
                    callbackUrl: "/bookings",
                  })
                }
                className="group p-4 border border-green-50 rounded-2xl bg-green-50/30 hover:bg-green-50 transition-all flex flex-col items-center gap-2 text-center cursor-pointer"
              >
                <div className="w-10 h-10 bg-white rounded-xl shadow-sm flex items-center justify-center text-green-600 group-hover:scale-110 transition-transform">
                  <Package size={20} />
                </div>
                <span className="id-eyebrow text-green-800">{t('demoGuest')}</span>
              </button>

              <button
                type="button"
                onClick={() =>
                  signIn("credentials", {
                    emailOrPhone: "esnaf@test.com",
                    password: DEMO_PASSWORD,
                    callbackUrl: "/partner",
                  })
                }
                className="group p-4 border border-blue-50 rounded-2xl bg-blue-50/30 hover:bg-blue-50 transition-all flex flex-col items-center gap-2 text-center cursor-pointer"
              >
                <div className="w-10 h-10 bg-white rounded-xl shadow-sm flex items-center justify-center text-blue-600 group-hover:scale-110 transition-transform">
                  <Store size={20} />
                </div>
                <span className="id-eyebrow text-blue-800">{t('demoPartner')}</span>
              </button>

              <button
                type="button"
                onClick={() =>
                  signIn("credentials", {
                    emailOrPhone: "admin@test.com",
                    password: DEMO_PASSWORD,
                    callbackUrl: "/admin",
                  })
                }
                className="group p-4 border border-purple-50 rounded-2xl bg-purple-50/30 hover:bg-purple-50 transition-all flex flex-col items-center gap-2 text-center cursor-pointer"
              >
                <div className="w-10 h-10 bg-white rounded-xl shadow-sm flex items-center justify-center text-purple-600 group-hover:scale-110 transition-transform">
                  <Shield size={20} />
                </div>
                <span className="id-eyebrow text-purple-800">{t('demoAdmin')}</span>
              </button>
            </div>
          </>
        )}

        {/* Güvenlik rozeti + gizlilik — kart içinde tam ortalı */}
        <div className="mt-8 pt-6 border-t border-gray-50 w-full text-center">
          <p className="text-sm text-gray-400 font-medium lowercase">
            {t('noAccount')} {' '}
            <Link 
              href={
                activeTab === 'PARTNER'
                  ? "/register?role=partner"
                  : withAuthCallback("/register", callbackUrl)
              } 
              className="text-orange-600 font-bold hover:underline"
            >
              {t('signUp')}
            </Link>
          </p>
        </div>

        <div className="mt-10 w-full flex flex-col items-center gap-0">
          <div className="inline-flex items-center justify-center gap-2 text-green-600 bg-green-50 px-4 py-2.5 rounded-xl border border-green-100 mx-auto">
            <ShieldCheck size={16} className="shrink-0" aria-hidden />
            <span className="id-eyebrow leading-tight text-center">
              {t('secureRegister')}
            </span>
          </div>
          <p className="mt-6 w-full max-w-xs mx-auto id-eyebrow text-gray-400 text-center leading-relaxed opacity-50 px-2">
            {t('privacyPolicy')}
          </p>
        </div>
      </motion.div>
    </div>
  );
}
