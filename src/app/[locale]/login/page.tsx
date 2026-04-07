"use client";

import { useTranslations } from 'next-intl';
import { signIn } from 'next-auth/react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useMemo, useState, useEffect } from 'react';
import { sanitizeAuthCallbackUrl } from '@/lib/auth-callback-url';
import { authErrorMessage } from '@/lib/auth-error-message';
import { Package, ShieldCheck, Globe, Loader2, Store, Shield, Mail, Lock, ChevronDown } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

/** Seed ile aynı varsayılan; `NEXT_PUBLIC_DEMO_PASSWORD` ile yerelde override edilebilir. */
const DEMO_PASSWORD =
  typeof process.env.NEXT_PUBLIC_DEMO_PASSWORD === "string" &&
  process.env.NEXT_PUBLIC_DEMO_PASSWORD.length > 0
    ? process.env.NEXT_PUBLIC_DEMO_PASSWORD
    : "Demo123!";

export default function LoginPage() {
  const t = useTranslations('Auth');
  const searchParams = useSearchParams();
  const rawCallback = searchParams.get('callbackUrl');
  const oauthErrorCode = searchParams.get('error');
  const callbackUrl = useMemo(
    () => sanitizeAuthCallbackUrl(rawCallback),
    [rawCallback],
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
  const [showEmailForm, setShowEmailForm] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [credError, setCredError] = useState('');
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
    setIsLoggingIn('credentials');
    try {
      const res = await signIn('credentials', {
        emailOrPhone: email.trim(),
        password,
        callbackUrl,
        redirect: false,
      });
      if (res?.error) {
        if (res.error === "EmailVerificationRequired") {
          setCredError(authErrorMessage(t, "EmailVerificationRequired"));
        } else {
          setCredError(t('invalidCredentials'));
        }
        setIsLoggingIn(null);
      } else if (res?.url) {
        window.location.href = res.url;
      }
    } catch {
      setCredError(t('invalidCredentials'));
      setIsLoggingIn(null);
    }
  };

  const busy = !!isLoggingIn;

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center p-6 font-sans">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-md bg-white rounded-[2.5rem] p-10 shadow-xl shadow-gray-200/50 border border-gray-100 flex flex-col items-center"
      >
        {/* Logo */}
        <div className="w-16 h-16 bg-orange-600 rounded-2xl flex items-center justify-center mb-8 shadow-lg shadow-orange-200">
          <Package size={32} className="text-white" />
        </div>

        <h1 className="text-2xl font-black text-gray-900 mb-2">{t('loginTitle')}</h1>
        <p className="text-gray-400 text-sm font-medium mb-10 text-center leading-relaxed">
          {t('loginSubtitle')}
        </p>

        {oauthBanner && (
          <p className="w-full text-xs text-red-600 font-semibold text-center mb-4 leading-snug px-1">
            {oauthBanner}
          </p>
        )}

        <div className="w-full flex flex-col gap-3">

          {/* Google */}
          <button
            onClick={() => handleOAuth('google')}
            disabled={busy}
            className="w-full h-14 bg-white border-2 border-gray-100 rounded-2xl flex items-center justify-center gap-3 hover:border-orange-200 transition-all active:scale-95 group disabled:opacity-50"
          >
            {isLoggingIn === 'google'
              ? <Loader2 size={20} className="animate-spin text-orange-600" />
              : <Globe size={20} className="text-gray-400 group-hover:text-orange-600 transition-colors" />}
            <span className="font-bold text-gray-900">{t('continueWithGoogle')}</span>
          </button>

          {/* Apple — yakında */}
          <div className="relative">
            <div className="w-full h-14 bg-gray-100 rounded-2xl flex items-center justify-center gap-3 cursor-not-allowed opacity-50 select-none">
              <Package size={20} className="text-gray-400" />
              <span className="font-bold text-gray-400">{t('continueWithApple')}</span>
            </div>
            <span className="absolute -top-2 -right-2 bg-orange-500 text-white text-[10px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full shadow">
              {t('comingSoon')}
            </span>
          </div>

          {/* Divider */}
          <div className="flex items-center gap-3 my-1">
            <div className="flex-1 h-px bg-gray-100" />
            <span className="text-[10px] font-black text-gray-300 uppercase tracking-[0.15em]">{t('orDivider')}</span>
            <div className="flex-1 h-px bg-gray-100" />
          </div>

          {/* E-posta formu toggle */}
          <button
            type="button"
            onClick={() => setShowEmailForm((v) => !v)}
            disabled={busy}
            className="w-full h-14 border-2 border-gray-100 rounded-2xl flex items-center justify-center gap-3 hover:border-orange-200 transition-all group disabled:opacity-50 relative"
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
                onSubmit={handleCredentials}
                className="overflow-hidden w-full flex flex-col gap-3"
              >
                {/* E-posta */}
                <div className="relative">
                  <Mail size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-300 pointer-events-none" />
                  <input
                    type="text"
                    placeholder={t('emailOrPhone')}
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    disabled={busy}
                    className="w-full h-12 pl-10 pr-4 border-2 border-gray-100 rounded-xl text-sm font-medium text-gray-800 placeholder-gray-300 focus:outline-none focus:border-orange-300 disabled:opacity-50 transition"
                  />
                </div>

                {/* Şifre */}
                <div className="relative">
                  <Lock size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-300 pointer-events-none" />
                  <input
                    type="password"
                    autoComplete="current-password"
                    placeholder={t('password')}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    disabled={busy}
                    className="w-full h-12 pl-10 pr-4 border-2 border-gray-100 rounded-xl text-sm font-medium text-gray-800 placeholder-gray-300 focus:outline-none focus:border-orange-300 disabled:opacity-50 transition"
                  />
                </div>

                {/* Hata */}
                {credError && (
                  <p className="text-xs text-red-500 font-semibold text-center">{credError}</p>
                )}

                {/* Giriş butonu */}
                <button
                  type="submit"
                  disabled={busy}
                  className="w-full h-12 bg-orange-600 hover:bg-orange-700 text-white rounded-xl font-bold text-sm transition-all active:scale-95 flex items-center justify-center gap-2 disabled:opacity-60"
                >
                  {isLoggingIn === 'credentials'
                    ? <><Loader2 size={16} className="animate-spin" />{t('signingIn')}</>
                    : t('signInEmail')}
                </button>
              </motion.form>
            )}
          </AnimatePresence>
        </div>

        {/* Demo mod — sadece dev */}
        {process.env.NODE_ENV !== "production" && (
          <>
            <div className="w-full flex items-center gap-3 my-6">
              <div className="flex-1 h-px bg-gray-100" />
              <span className="text-[10px] font-black text-gray-300 uppercase tracking-[0.2em]">{t('demoMode')}</span>
              <div className="flex-1 h-px bg-gray-100" />
            </div>

            <div className="w-full grid grid-cols-1 sm:grid-cols-3 gap-3">
              <button
                type="button"
                onClick={() => signIn("credentials", { email: "misafir@test.com", password: DEMO_PASSWORD, callbackUrl: "/tr/bookings" })}
                className="group p-4 border border-green-50 rounded-2xl bg-green-50/30 hover:bg-green-50 transition-all flex flex-col items-center gap-2 text-center"
              >
                <div className="w-10 h-10 bg-white rounded-xl shadow-sm flex items-center justify-center text-green-600 group-hover:scale-110 transition-transform">
                  <Package size={20} />
                </div>
                <span className="text-[10px] font-black text-green-800 uppercase tracking-widest">{t('demoGuest')}</span>
              </button>

              <button
                type="button"
                onClick={() => signIn("credentials", { email: "esnaf@test.com", password: DEMO_PASSWORD, callbackUrl: "/tr/partner" })}
                className="group p-4 border border-blue-50 rounded-2xl bg-blue-50/30 hover:bg-blue-50 transition-all flex flex-col items-center gap-2 text-center"
              >
                <div className="w-10 h-10 bg-white rounded-xl shadow-sm flex items-center justify-center text-blue-600 group-hover:scale-110 transition-transform">
                  <Store size={20} />
                </div>
                <span className="text-[10px] font-black text-blue-800 uppercase tracking-widest">{t('demoPartner')}</span>
              </button>

              <button
                type="button"
                onClick={() => signIn("credentials", { email: "admin@test.com", password: DEMO_PASSWORD, callbackUrl: "/tr/admin" })}
                className="group p-4 border border-purple-50 rounded-2xl bg-purple-50/30 hover:bg-purple-50 transition-all flex flex-col items-center gap-2 text-center"
              >
                <div className="w-10 h-10 bg-white rounded-xl shadow-sm flex items-center justify-center text-purple-600 group-hover:scale-110 transition-transform">
                  <Shield size={20} />
                </div>
                <span className="text-[10px] font-black text-purple-800 uppercase tracking-widest">{t('demoAdmin')}</span>
              </button>
            </div>
          </>
        )}

        {/* Güvenlik rozeti + gizlilik — kart içinde tam ortalı */}
        <div className="mt-8 pt-6 border-t border-gray-50 w-full text-center">
          <p className="text-sm text-gray-400 font-medium lowercase">
            {t('noAccount')} {' '}
            <Link href="/register" className="text-orange-600 font-bold hover:underline">
              {t('signUp')}
            </Link>
          </p>
        </div>

        <div className="mt-10 w-full flex flex-col items-center gap-0">
          <div className="inline-flex items-center justify-center gap-2 text-green-600 bg-green-50 px-4 py-2.5 rounded-xl border border-green-100 mx-auto">
            <ShieldCheck size={16} className="shrink-0" aria-hidden />
            <span className="text-[10px] font-black uppercase tracking-widest leading-tight text-center">
              {t('secureRegister')}
            </span>
          </div>
          <p className="mt-6 w-full max-w-xs mx-auto text-[10px] text-gray-400 font-bold text-center leading-relaxed uppercase tracking-widest opacity-50 px-2">
            {t('privacyPolicy')}
          </p>
        </div>
      </motion.div>
    </div>
  );
}
