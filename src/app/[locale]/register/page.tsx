"use client";

import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { registerGuestAction } from '@/actions/register';
import { Package, ShieldCheck, Loader2, Mail, Lock, User, ChevronRight } from 'lucide-react';
import { motion } from 'framer-motion';
import Link from 'next/link';

export default function RegisterPage() {
  const t = useTranslations('Auth');
  const router = useRouter();
  
  const [isPending, setIsPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsPending(true);
    setError(null);

    try {
      const res = await registerGuestAction(formData);
      if (res.success) {
        setSuccess(true);
      } else {
        setError(res.error || 'Bir hata oluştu.');
      }
    } catch {
      setError('Sistem hatası. Lütfen sonra tekrar deneyin.');
    } finally {
      setIsPending(false);
    }
  };

  if (success) {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center p-6 font-sans">
        <motion.div 
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="w-full max-w-md bg-white rounded-[2.5rem] p-10 shadow-xl shadow-gray-200/50 border border-gray-100 text-center"
        >
          <div className="w-16 h-16 bg-green-100 rounded-2xl flex items-center justify-center mb-8 mx-auto">
            <Mail size={32} className="text-green-600" />
          </div>
          <h1 className="text-2xl font-black text-gray-900 mb-4">Harika!</h1>
          <p className="text-gray-500 text-sm font-medium mb-8 leading-relaxed">
            Kaydınız başarıyla oluşturuldu. Lütfen e-posta adresinize gönderdiğimiz doğrulama linkine tıklayarak hesabınızı aktif hale getirin.
          </p>
          <Link 
            href="/login"
            className="inline-flex items-center justify-center gap-2 text-sm font-bold text-orange-600 hover:text-orange-700 transition-colors"
          >
            Giriş sayfasına dön <ChevronRight size={16} />
          </Link>
        </motion.div>
      </div>
    );
  }

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

        <h1 className="text-2xl font-black text-gray-900 mb-2">Aramıza Katıl</h1>
        <p className="text-gray-400 text-sm font-medium mb-10 text-center leading-relaxed">
          Valizlerinizi güvenle emanet etmek için hemen hesap oluşturun.
        </p>

        <form onSubmit={handleSubmit} className="w-full flex flex-col gap-4">
          <div className="relative">
            <User size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-300 pointer-events-none" />
            <input
              type="text"
              placeholder="Ad Soyad"
              required
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              className="w-full h-12 pl-10 pr-4 border-2 border-gray-100 rounded-xl text-sm font-medium text-gray-800 focus:outline-none focus:border-orange-300 transition"
            />
          </div>

          <div className="relative">
            <Mail size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-300 pointer-events-none" />
            <input
              type="email"
              placeholder="E-posta Adresi"
              required
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              className="w-full h-12 pl-10 pr-4 border-2 border-gray-100 rounded-xl text-sm font-medium text-gray-800 focus:outline-none focus:border-orange-300 transition"
            />
          </div>

          <div className="relative">
            <Lock size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-300 pointer-events-none" />
            <input
              type="password"
              placeholder="Şifre"
              required
              minLength={8}
              value={formData.password}
              onChange={(e) => setFormData({ ...formData, password: e.target.value })}
              className="w-full h-12 pl-10 pr-4 border-2 border-gray-100 rounded-xl text-sm font-medium text-gray-800 focus:outline-none focus:border-orange-300 transition"
            />
          </div>

          {error && (
            <p className="text-xs text-red-500 font-semibold text-center">{error}</p>
          )}

          <button
            type="submit"
            disabled={isPending}
            className="w-full h-12 bg-orange-600 hover:bg-orange-700 text-white rounded-xl font-bold text-sm transition-all active:scale-95 flex items-center justify-center gap-2 disabled:opacity-60 mt-2"
          >
            {isPending ? <Loader2 size={16} className="animate-spin" /> : "Hesap Oluştur"}
          </button>
        </form>

        <div className="mt-8 pt-8 border-t border-gray-50 w-full text-center">
          <p className="text-sm text-gray-400 font-medium">
            Zaten hesabın var mı? {' '}
            <Link href="/login" className="text-orange-600 font-bold hover:underline">Giriş Yap</Link>
          </p>
        </div>

        <div className="mt-10 w-full flex flex-col items-center gap-0">
          <div className="inline-flex items-center justify-center gap-2 text-green-600 bg-green-50 px-4 py-2.5 rounded-xl border border-green-100 mx-auto">
            <ShieldCheck size={16} className="shrink-0" />
            <span className="text-[10px] font-black uppercase tracking-widest leading-tight">
              Güvenli Kayıt
            </span>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
