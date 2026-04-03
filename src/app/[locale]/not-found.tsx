"use client";

import { useTranslations } from 'next-intl';
import { Search, MapPin } from 'lucide-react';
import { Link } from '@/i18n/routing';
import { motion } from 'framer-motion';

export default function NotFound() {
  const t = useTranslations('Common');

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-6 text-center">
      <motion.div 
        initial={{ y: 20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        className="flex flex-col items-center gap-10 max-w-sm"
      >
        <div className="relative">
          <div className="bg-orange-100/50 p-12 rounded-full blur-2xl absolute -z-10 -inset-4"></div>
          <div className="bg-orange-600 p-8 rounded-[3rem] text-white rotate-6 shadow-2xl shadow-orange-100">
            <Search size={64} strokeWidth={1} />
          </div>
          <div className="absolute -bottom-4 -right-4 bg-gray-900 p-4 rounded-3xl text-white -rotate-12 shadow-xl">
             <MapPin size={32} />
          </div>
        </div>

        <div className="flex flex-col gap-3">
           <h1 className="text-5xl font-black tracking-tighter text-gray-900 uppercase">KAYBOLDUN!</h1>
           <p className="text-base text-gray-400 font-medium px-4">Aradığın emanet noktası burası değil gibi görünüyor. Belki de henüz keşfedilmemiştir?</p>
        </div>
        
        <Link
          href="/"
          className="w-full bg-gray-900 hover:bg-black text-white py-5 rounded-3xl font-black flex items-center justify-center gap-2 transition-all active:scale-95 shadow-2xl shadow-gray-200"
        >
          ANASAYFAYA DÖN
        </Link>
      </motion.div>
    </div>
  );
}
