import { useTranslations } from 'next-intl';
import { Search, MapPin, ShieldCheck, Clock } from 'lucide-react';
import { Link } from '@/i18n/routing';

/**
 * Guest Landing Page - Turist Karşılama Sayfası
 * Minimalist, güven veren ve hızlı aksiyon odaklı tasarım.
 */
export default function GuestPage() {
  const t = useTranslations('Guest');
  const common = useTranslations('Common');

  return (
    <div className="flex flex-col min-h-screen bg-white text-gray-900">
      {/* Hero Section */}
      <header className="relative pt-32 pb-20 px-6 flex flex-col items-center text-center bg-gray-50 overflow-hidden">
        {/* Subtle Background Pattern */}
        <div className="absolute inset-0 opacity-[0.03] pointer-events-none">
          <div className="absolute top-0 left-0 w-full h-full bg-[radial-gradient(#ea580c_1px,transparent_1px)] [background-size:20px_20px]"></div>
        </div>

        <div className="relative z-10 max-w-2xl">
          <h1 className="text-4xl md:text-6xl font-black tracking-tight text-gray-900 mb-6 leading-[1.1]">
            {t('heroTitle')}
          </h1>
          <p className="text-lg text-gray-500 mb-10 max-w-md mx-auto">
            {t('heroSubtitle')}
          </p>

          {/* Minimalist Search Bar UI */}
          <Link 
            href="/search"
            className="w-full max-w-lg mx-auto bg-white border border-gray-200 shadow-xl rounded-2xl p-2 flex items-center gap-3 hover:border-orange-200 transition-all group"
          >
            <div className="bg-orange-50 p-3 rounded-xl text-orange-600 group-hover:bg-orange-100 transition-colors">
              <Search size={24} />
            </div>
            <div className="flex-1 text-left">
              <p className="text-xs text-gray-400 font-bold uppercase tracking-wider">{common('search')}</p>
              <p className="text-gray-400 font-medium">{t('searchPlaceholder')}</p>
            </div>
            <div className="bg-orange-600 text-white px-5 py-3 rounded-xl font-bold hidden sm:block">
              {t('findShops')}
            </div>
          </Link>
        </div>
      </header>

      {/* Trust Features - Minimalist Icons */}
      <section className="py-20 px-6 max-w-5xl mx-auto w-full grid grid-cols-1 md:grid-cols-3 gap-12 text-center text-sm">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 flex items-center justify-center text-orange-600 border border-orange-100 rounded-2xl bg-orange-50">
            <ShieldCheck size={28} />
          </div>
          <div>
            <h4 className="font-bold mb-1">{t('insuranceIncluded')}</h4>
            <p className="text-gray-500 leading-relaxed">Tüm valizleriniz anlaşmalı sigorta kapsamında %100 güvendedir.</p>
          </div>
        </div>
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 flex items-center justify-center text-orange-600 border border-orange-100 rounded-2xl bg-orange-50">
            <MapPin size={28} />
          </div>
          <div>
            <h4 className="font-bold mb-1">Geniş Ağ</h4>
            <p className="text-gray-500 leading-relaxed">İstanbul'un en turistik noktalarında binlerce yan dükkan.</p>
          </div>
        </div>
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 flex items-center justify-center text-orange-600 border border-orange-100 rounded-2xl bg-orange-50">
            <Clock size={28} />
          </div>
          <div>
            <h4 className="font-bold mb-1">7/24 Destek</h4>
            <p className="text-gray-500 leading-relaxed">Herhangi bir uyuşmazlıkta 7/24 yanınızdayız.</p>
          </div>
        </div>
      </section>

    </div>
  );
}

