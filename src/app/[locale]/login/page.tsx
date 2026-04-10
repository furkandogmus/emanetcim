"use client";

import { useTranslations } from 'next-intl';
import { signIn } from 'next-auth/react';
import { useSearchParams } from 'next/navigation';
import { useState } from 'react';
import { Package, ShieldCheck, Globe, Loader2, Store, Shield } from 'lucide-react';
import { motion } from 'framer-motion';

/**
 * Login Page - Giriş Portalı
 * Gerçek OAuth (Google/Apple) akışı.
 */
export default function LoginPage() {
  const t = useTranslations('Auth');
  const searchParams = useSearchParams();
  const callbackUrl = searchParams.get('callbackUrl') || '/';
  const [isLoggingIn, setIsLoggingIn] = useState<string | null>(null);

  const handleLogin = async (provider: string) => {
    setIsLoggingIn(provider);
    try {
      await signIn(provider, { callbackUrl });
    } catch (error) {
      console.error('Login error:', error);
      setIsLoggingIn(null);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center p-6 font-sans">
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-md bg-white rounded-[2.5rem] p-10 shadow-xl shadow-gray-200/50 border border-gray-100 flex flex-col items-center"
      >
        <div className="w-16 h-16 bg-orange-600 rounded-2xl flex items-center justify-center mb-8 shadow-lg shadow-orange-200">
           <Package size={32} className="text-white" />
        </div>

        <h1 className="text-2xl font-black text-gray-900 mb-2">{t('loginTitle')}</h1>
        <p className="text-gray-400 text-sm font-medium mb-10 text-center leading-relaxed">
          {t('loginSubtitle')}
        </p>

        <div className="w-full flex flex-col gap-4">
          <button 
            onClick={() => handleLogin('google')}
            disabled={!!isLoggingIn}
            className="w-full h-16 bg-white border-2 border-gray-100 rounded-2xl flex items-center justify-center gap-4 hover:border-orange-200 transition-all active:scale-95 group disabled:opacity-50"
          >
            {isLoggingIn === 'google' ? <Loader2 className="animate-spin text-orange-600" /> : <Globe className="text-gray-400 group-hover:text-orange-600 transition-colors" />}
            <span className="font-bold text-gray-900">Google ile Devam Et</span>
          </button>

          <button 
            onClick={() => handleLogin('apple')}
            disabled={!!isLoggingIn}
            className="w-full h-16 bg-gray-900 text-white rounded-2xl flex items-center justify-center gap-4 hover:bg-black transition-all active:scale-95 disabled:opacity-50"
          >
            {isLoggingIn === 'apple' ? <Loader2 className="animate-spin" /> : <Package size={20} />}
            <span className="font-bold">Apple ile Devam Et</span>
          </button>
        </div>

        <div className="w-full h-px bg-gray-100 my-8 flex items-center justify-center">
           <span className="bg-white px-4 text-[10px] font-black text-gray-300 uppercase tracking-[0.2em]">VEYA DEMO MODU</span>
        </div>

        <div className="w-full grid grid-cols-1 sm:grid-cols-3 gap-4">
          <button
            onClick={() => signIn('credentials', { email: 'misafir@örnek.com', password: process.env.NEXT_PUBLIC_DEMO_PASSWORD ?? 'Demo123!', callbackUrl: '/tr/bookings' })}
            className="group p-4 border border-green-50 rounded-2xl bg-green-50/30 hover:bg-green-50 transition-all flex flex-col items-center gap-2 text-center"
          >
            <div className="w-10 h-10 bg-white rounded-xl shadow-sm flex items-center justify-center text-green-600 group-hover:scale-110 transition-transform">
               <Package size={20} />
            </div>
            <span className="text-[10px] font-black text-green-800 uppercase tracking-widest">Misafir Demo</span>
          </button>

          <button
            onClick={() => signIn('credentials', { email: 'galata@shop.com', password: process.env.NEXT_PUBLIC_DEMO_PASSWORD ?? 'Demo123!', callbackUrl: '/tr/partner' })}
            className="group p-4 border border-blue-50 rounded-2xl bg-blue-50/30 hover:bg-blue-50 transition-all flex flex-col items-center gap-2 text-center"
          >
            <div className="w-10 h-10 bg-white rounded-xl shadow-sm flex items-center justify-center text-blue-600 group-hover:scale-110 transition-transform">
               <Store size={20} />
            </div>
            <span className="text-[10px] font-black text-blue-800 uppercase tracking-widest">Esnaf Girişi</span>
          </button>

          <button
            onClick={() => signIn('credentials', { email: 'admin@emanetci.com', password: process.env.NEXT_PUBLIC_DEMO_PASSWORD ?? 'Demo123!', callbackUrl: '/tr/admin' })}
            className="group p-4 border border-purple-50 rounded-2xl bg-purple-50/30 hover:bg-purple-50 transition-all flex flex-col items-center gap-2 text-center"
          >
            <div className="w-10 h-10 bg-white rounded-xl shadow-sm flex items-center justify-center text-purple-600 group-hover:scale-110 transition-transform">
               <Shield size={20} />
            </div>
            <span className="text-[10px] font-black text-purple-800 uppercase tracking-widest">Admin Girişi</span>
          </button>
        </div>

        <div className="mt-12 flex items-center gap-2 text-green-600 bg-green-50 px-4 py-2 rounded-xl border border-green-100">
           <ShieldCheck size={16} />
           <span className="text-[10px] font-black uppercase tracking-widest leading-none">Safe & Secure Auth</span>
        </div>

        <p className="mt-8 text-[10px] text-gray-400 font-bold max-w-[200px] text-center leading-normal uppercase tracking-widest opacity-50">
           {t('privacyPolicy')}
        </p>
      </motion.div>

    </div>
  );
}
