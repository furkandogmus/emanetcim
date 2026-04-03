"use client";

import { useTranslations } from 'next-intl';
import { useState, useMemo, useCallback } from 'react';
import { Search as SearchIcon, ChevronLeft } from 'lucide-react';
import { Link } from '@/i18n/routing';
import { useRouter } from '@/i18n/routing';
import ShopListItem from '@/components/guest/ShopListItem';
import SearchMap from '@/components/guest/SearchMap';
import { motion, AnimatePresence } from 'framer-motion';

interface SearchClientProps {
  initialShops: any[];
}

/**
 * Arama: filtreler, mesafe (sunucu), harita (MapLibre).
 */
export default function SearchClient({ initialShops }: SearchClientProps) {
  const t = useTranslations('Guest');
  const router = useRouter();
  const [searchQuery, setSearchQuery] = useState("");
  const [minRating, setMinRating] = useState(0);
  const [maxPrice, setMaxPrice] = useState(500);
  const [open247Only, setOpen247Only] = useState(false);
  const [hasRestroom, setHasRestroom] = useState(false);

  const onSelectShop = useCallback(
    (id: string) => {
      router.push(`/checkout/${id}`);
    },
    [router]
  );

  const filteredShops = useMemo(() => {
    return initialShops.filter((shop) => {
      const matchText =
        shop.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (shop.address && shop.address.toLowerCase().includes(searchQuery.toLowerCase()));
      const r = shop.rating ?? 0;
      const p = shop.pricePerDay ?? 50;
      const open = open247Only ? shop.open247 === true : true;
      const wc = hasRestroom ? shop.hasRestroom === true : true;
      return matchText && r >= minRating && p <= maxPrice && open && wc;
    });
  }, [searchQuery, initialShops, minRating, maxPrice, open247Only, hasRestroom]);

  return (
    <div className="flex flex-col h-screen bg-white font-sans selection:bg-orange-100">
      <header className="px-4 pt-4 pb-3 border-b border-gray-100 bg-white/80 backdrop-blur-xl z-20 sticky top-0">
        <div className="flex items-center gap-3 mb-3">
          <Link href="/" className="w-10 h-10 flex items-center justify-center bg-gray-50 hover:bg-gray-100 rounded-full transition-all active:scale-95">
            <ChevronLeft size={22} className="text-gray-900" />
          </Link>
          <div className="flex-1">
            <h1 className="text-xs font-black text-gray-400 uppercase tracking-[0.2em]">{t('searchPlaceholder')}</h1>
            <p className="text-sm font-bold text-gray-900 truncate">İstanbul, Galata</p>
          </div>
        </div>

        <div className="relative group mb-3">
          <div className="absolute inset-y-0 left-4 flex items-center pointer-events-none">
            <SearchIcon size={18} className="text-gray-400 group-focus-within:text-orange-600 transition-colors" />
          </div>
          <input
            type="text"
            placeholder={t('searchPlaceholder')}
            className="w-full pl-12 pr-4 py-3.5 bg-gray-50 border border-transparent focus:border-orange-500/30 focus:bg-white focus:ring-4 focus:ring-orange-500/5 rounded-2xl text-base font-semibold placeholder:text-gray-400 transition-all shadow-sm outline-none"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>

        <div className="flex flex-wrap gap-2 text-[10px] font-bold uppercase tracking-widest">
          <label className="flex items-center gap-1 bg-gray-50 px-2 py-1 rounded-lg">
            Min ★
            <input
              type="number"
              min={0}
              max={5}
              step={0.1}
              className="w-12 bg-transparent border-none text-xs font-black"
              value={minRating}
              onChange={(e) => setMinRating(Number(e.target.value) || 0)}
            />
          </label>
          <label className="flex items-center gap-1 bg-gray-50 px-2 py-1 rounded-lg">
            Max ₺
            <input
              type="number"
              min={0}
              className="w-14 bg-transparent border-none text-xs font-black"
              value={maxPrice}
              onChange={(e) => setMaxPrice(Number(e.target.value) || 500)}
            />
          </label>
          <label className="flex items-center gap-1 cursor-pointer">
            <input type="checkbox" checked={open247Only} onChange={(e) => setOpen247Only(e.target.checked)} />
            7/24
          </label>
          <label className="flex items-center gap-1 cursor-pointer">
            <input type="checkbox" checked={hasRestroom} onChange={(e) => setHasRestroom(e.target.checked)} />
            WC
          </label>
        </div>
      </header>

      <main className="flex-1 flex flex-col md:flex-row overflow-hidden relative">
        <div className="w-full md:w-1/3 lg:w-1/4 h-1/2 md:h-full overflow-y-auto p-4 flex flex-col gap-4 bg-gray-50/50 border-r border-gray-100 order-2 md:order-1">
          <div className="flex justify-between items-center px-1 mb-2">
            <h2
              data-testid="nearby-heading"
              className="text-sm font-black text-gray-900 uppercase tracking-widest"
            >
              {t('nearbyShops')} ({filteredShops.length})
            </h2>
          </div>

          <div className="flex flex-col gap-3">
            <AnimatePresence mode="popLayout">
              {filteredShops.map((shop, index) => (
                <motion.div
                  key={shop.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  transition={{ delay: index * 0.05 }}
                >
                  <ShopListItem
                    name={shop.name}
                    rating={shop.rating || 0}
                    price={shop.pricePerDay?.toString() || "50"}
                    distance={shop.distanceKm != null ? Math.round(shop.distanceKm * 1000).toString() : "—"}
                    onClick={() => router.push(`/checkout/${shop.id}`)}
                  />
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        </div>

        <div className="flex-1 h-1/2 md:h-full bg-gray-100 relative order-1 md:order-2 overflow-hidden">
          <SearchMap
            key={filteredShops.map((s) => s.id).join("_")}
            shops={filteredShops}
            onSelectShop={onSelectShop}
          />
        </div>
      </main>
    </div>
  );
}
