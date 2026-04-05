"use client";

import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { registerGuestAction, registerPartnerApplicationAction } from '@/actions/register';
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
  MapPin,
  CheckCircle2
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { Link } from '@/i18n/routing';

type RegisterType = 'GUEST' | 'PARTNER';

export default function RegisterPage() {
  const t = useTranslations('Auth');
  const adminT = useTranslations('Admin');
  const [activeTab, setActiveTab] = useState<RegisterType>('GUEST');
  
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
    shopAddress: '',
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsPending(true);
    setError(null);

    try {
      if (activeTab === 'GUEST') {
        const res = await registerGuestAction(guestData);
        if (res.success) setSuccess(true);
        else setError(res.error || 'Bir hata oluştu.');
      } else {
        const res = await registerPartnerApplicationAction(partnerData);
        if (res.success) setSuccess(true);
        else setError(res.error || 'Bir hata oluştu.');
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
            {activeTab === 'GUEST' ? <Mail size={32} className="text-green-600" /> : <CheckCircle2 size={32} className="text-green-600" />}
          </div>
          <h1 className="text-2xl font-black text-gray-900 mb-4">Harika!</h1>
          <p className="text-gray-500 text-sm font-medium mb-8 leading-relaxed">
            {activeTab === 'GUEST' 
              ? "Kaydınız başarıyla oluşturuldu. Lütfen e-posta adresinize gönderdiğimiz doğrulama linkine tıklayarak hesabınızı aktif hale getirin."
              : "Başvurunuz başarıyla alındı! Ekibimiz bilgilerinizi inceleyip onayladıktan sonra size bildirim göndereceğiz. Sabrınız için teşekkürler."
            }
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
    <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center p-6 font-sans overflow-y-auto pt-20 pb-20">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-md bg-white rounded-[2.5rem] p-8 md:p-10 shadow-xl shadow-gray-200/50 border border-gray-100 flex flex-col"
      >
        <div className="flex flex-col items-center mb-8">
          <div className="w-16 h-16 bg-orange-600 rounded-2xl flex items-center justify-center mb-6 shadow-lg shadow-orange-200">
            <Package size={32} className="text-white" />
          </div>

          <h1 className="text-2xl font-black text-gray-900 mb-2">Aramıza Katıl</h1>
          <p className="text-gray-400 text-sm font-medium text-center leading-relaxed">
            Hemen hesap oluşturun ve Emanetçi ayrıcalıklarından faydalanın.
          </p>
        </div>

        {/* Tabs */}
        <div className="flex p-1 bg-gray-50 rounded-2xl gap-1 mb-8">
          <button
            onClick={() => setActiveTab('GUEST')}
            className={`flex-1 py-3 text-[10px] font-black uppercase tracking-widest rounded-xl transition-all ${
              activeTab === 'GUEST' ? "bg-white text-orange-600 shadow-sm" : "text-gray-400 hover:text-gray-600"
            }`}
          >
            Misafir
          </button>
          <button
            onClick={() => setActiveTab('PARTNER')}
            className={`flex-1 py-3 text-[10px] font-black uppercase tracking-widest rounded-xl transition-all ${
              activeTab === 'PARTNER' ? "bg-white text-orange-600 shadow-sm" : "text-gray-400 hover:text-gray-600"
            }`}
          >
            Esnaf
          </button>
        </div>

        <form onSubmit={handleSubmit} className="w-full flex flex-col gap-4">
          <div className="relative">
            <User size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-300 pointer-events-none" />
            <input
              type="text"
              placeholder="Ad Soyad"
              required
              value={activeTab === 'GUEST' ? guestData.name : partnerData.name}
              onChange={(e) => activeTab === 'GUEST' 
                ? setGuestData({...guestData, name: e.target.value})
                : setPartnerData({...partnerData, name: e.target.value})
              }
              className="w-full h-12 pl-10 pr-4 border-2 border-gray-100 rounded-xl text-sm font-medium text-gray-800 focus:outline-none focus:border-orange-300 transition"
            />
          </div>

          {activeTab === 'GUEST' ? (
            <div className="relative">
              <Mail size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-300 pointer-events-none" />
              <input
                type="email"
                placeholder="E-posta Adresi"
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
                placeholder="Telefon Numarası (05XX...)"
                required
                value={partnerData.phone}
                onChange={(e) => setPartnerData({ ...partnerData, phone: e.target.value })}
                className="w-full h-12 pl-10 pr-4 border-2 border-gray-100 rounded-xl text-sm font-medium text-gray-800 focus:outline-none focus:border-orange-300 transition"
              />
            </div>
          )}

          <div className="relative">
            <Lock size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-300 pointer-events-none" />
            <input
              type="password"
              placeholder="Şifre"
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

          {activeTab === 'PARTNER' && (
            <motion.div 
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              className="flex flex-col gap-4 overflow-hidden"
            >
              <div className="relative">
                <Store size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-300 pointer-events-none" />
                <input
                  type="text"
                  placeholder="Dükkan Adı"
                  required
                  value={partnerData.shopName}
                  onChange={(e) => setPartnerData({ ...partnerData, shopName: e.target.value })}
                  className="w-full h-12 pl-10 pr-4 border-2 border-gray-100 rounded-xl text-sm font-medium text-gray-800 focus:outline-none focus:border-orange-300 transition"
                />
              </div>
              <div className="relative">
                <MapPin size={16} className="absolute left-4 top-4 text-gray-300 pointer-events-none" />
                <textarea
                  placeholder="Dükkan Adresi"
                  required
                  rows={3}
                  value={partnerData.shopAddress}
                  onChange={(e) => setPartnerData({ ...partnerData, shopAddress: e.target.value })}
                  className="w-full pl-10 pr-4 py-3 border-2 border-gray-100 rounded-xl text-sm font-medium text-gray-800 focus:outline-none focus:border-orange-300 transition min-h-[80px]"
                />
              </div>
            </motion.div>
          )}

          {error && (
            <p className="text-xs text-red-500 font-semibold text-center mt-2">{error}</p>
          )}

          <button
            type="submit"
            disabled={isPending}
            className="w-full h-12 bg-orange-600 hover:bg-orange-700 text-white rounded-xl font-bold text-sm transition-all active:scale-95 flex items-center justify-center gap-2 disabled:opacity-60 mt-4"
          >
            {isPending ? <Loader2 size={16} className="animate-spin" /> : (activeTab === 'PARTNER' ? "Başvuruyu Tamamla" : "Hesap Oluştur")}
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
