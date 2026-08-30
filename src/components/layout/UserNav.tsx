"use client";

import { signOut, useSession } from 'next-auth/react';
import type { LucideIcon } from 'lucide-react';
import { User, LogOut, Shield, Store, ChevronDown, Fingerprint } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Link } from '@/i18n/routing';
import { useTranslations } from 'next-intl';

export default function UserNav() {
  const t = useTranslations('UserNav');
  const { data: session, status } = useSession();
  const [isOpen, setIsOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isOpen) return;
    const handlePointerDown = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    const handleEsc = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setIsOpen(false);
    };
    document.addEventListener('mousedown', handlePointerDown);
    document.addEventListener('keydown', handleEsc);
    return () => {
      document.removeEventListener('mousedown', handlePointerDown);
      document.removeEventListener('keydown', handleEsc);
    };
  }, [isOpen]);

  if (status === 'loading') return <div className="w-8 h-8 rounded-full bg-gray-100 animate-pulse" />;
  if (status === 'unauthenticated') {
    return (
      /*
        `min-w-0 truncate`: bu dugme baslikta esneyebilmeli. Olculdu
        (2026-08-31): metin boyutu %200'e cikarildiginda (WCAG 1.4.4, az goren
        kullanicinin gunluk ayari) dugme 184 px'e ciktigi icin sayfa 93 px yana
        kaydiriyordu -- logo o noktada zaten "B..."ye inmisti, kucullecek baska
        oge kalmamisti. Ayni sinir Fransizca "Se connecter" gibi uzun
        etiketlerde de zorlaniyor.
      */
      <Link 
        href="/login" 
        className="btn-ui btn-ui-md btn-ui-primary rounded-full min-w-0 truncate"
      >
        {t('signIn')}
      </Link>
    );
  }

  const roleLabels: Record<string, { labelKey: 'roleAdmin' | 'rolePartner' | 'roleGuest'; icon: LucideIcon; color: string }> = {
    'ADMIN': { labelKey: 'roleAdmin', icon: Shield, color: 'text-purple-600' },
    'PARTNER': { labelKey: 'rolePartner', icon: Store, color: 'text-blue-600' },
    'GUEST': { labelKey: 'roleGuest', icon: User, color: 'text-orange-600' }
  };

  const currentRole = roleLabels[session?.user?.role as string] || roleLabels['GUEST'];
  const Icon = currentRole.icon;

  return (
    <div className="relative" ref={menuRef}>
      <button 
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        aria-expanded={isOpen}
        aria-haspopup="menu"
        className="flex items-center gap-3 bg-white border border-gray-100 p-2 pr-4 rounded-full shadow-sm hover:shadow-md transition-all active:scale-95"
      >
        <div className="w-8 h-8 rounded-full bg-orange-50 text-orange-600 flex items-center justify-center font-bold text-sm">
          {session?.user?.name?.[0] || 'U'}
        </div>
        <div className="hidden sm:block text-left">
          <p className="text-[10px] font-black text-gray-400 uppercase tracking-tighter leading-none mb-1">{t('welcomeGreeting')}</p>
          <p className="text-xs font-bold text-gray-900 leading-none">{session?.user?.name?.split(' ')[0]}</p>
        </div>
        <ChevronDown size={14} className={`text-gray-400 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      <AnimatePresence>
        {isOpen && (
          <motion.div 
            initial={{ opacity: 0, y: 10, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 10, scale: 0.95 }}
            role="menu"
            className="absolute right-0 mt-3 w-56 bg-white rounded-3xl shadow-2xl border border-gray-100 overflow-hidden z-[100]"
          >
            <div className="p-6 border-b border-gray-100 bg-gray-50/50">
               <div className="flex items-center gap-2 mb-1">
                  <Icon size={14} className={currentRole.color} />
                  <span className={` id-eyebrow ${currentRole.color}`}>{t(currentRole.labelKey)}</span>
               </div>
               <p className="text-xs font-bold text-gray-500 truncate">{session?.user?.email}</p>
            </div>

            <div className="p-2">
              <Link 
                href={session?.user?.role === 'PARTNER' ? '/partner' : session?.user?.role === 'ADMIN' ? '/admin' : '/bookings'}
                onClick={() => setIsOpen(false)}
                role="menuitem"
                className="flex items-center gap-3 w-full p-4 hover:bg-gray-50 rounded-2xl transition-colors text-sm font-bold text-gray-700 cursor-pointer"
              >
                <Icon size={18} />
                {session?.user?.role === 'ADMIN' ? t('navAdminPanel') : session?.user?.role === 'PARTNER' ? t('navPartnerPanel') : t('navBookings')}
              </Link>

              {session?.user?.role === 'GUEST' ? (
                <Link
                  href="/account/privacy"
                  onClick={() => setIsOpen(false)}
                  role="menuitem"
                  className="flex items-center gap-3 w-full p-4 hover:bg-gray-50 rounded-2xl transition-colors text-sm font-bold text-gray-700 cursor-pointer"
                >
                  <Fingerprint size={18} />
                  {t('navPrivacyData')}
                </Link>
              ) : null}
              
              <button 
                type="button"
                role="menuitem"
                onClick={() => signOut()}
                className="flex items-center gap-3 w-full p-4 hover:bg-red-50 rounded-2xl transition-colors text-sm font-bold text-red-600"
              >
                <LogOut size={18} />
                {t('signOut')}
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
