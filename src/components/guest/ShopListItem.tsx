"use client";

import { Building2, ChevronRight, MapPin, Star, Shield } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import { motion } from 'framer-motion';
import FavoriteButton from '@/components/guest/FavoriteButton';
import Money from "@/components/common/Money";
import { formatDecimal } from "@/lib/currency";
import { ResponseTimeBadge, VerifiedBadge } from "@/components/common/TrustBadge";

interface ShopListItemProps {
  id: string;
  name: string;
  rating: number;
  /** Günlük fiyat (TRY). Sayı olarak taşınır — gösterim `Money` bileşeninin işi. */
  price: number;
  distance: string;
  lat?: number;
  lng?: number;
  bagsAvailable?: number;
  isVerified?: boolean;
  responseTimeMinutes?: number | null;
  slotPrices?: { s: number; m: number; xl: number };
  onClick?: () => void;
}

/**
 * ShopListItem - Misafir Arama Sonucu Kartı
 * Minimalist, fiyat ve güven odaklı tasarım.
 */
export default function ShopListItem({
  id,
  name,
  rating,
  price,
  distance,
  lat,
  lng,
  bagsAvailable,
  isVerified,
  responseTimeMinutes,
  slotPrices,
  onClick,
}: ShopListItemProps) {
  const t = useTranslations('Guest');
  const locale = useLocale();
  return (
    <motion.div
      data-testid="shop-list-item"
      onClick={onClick}
      whileTap={{ scale: 0.97 }}
      transition={{ type: "spring", stiffness: 400, damping: 17 }}
      className="bg-white border border-gray-100 rounded-3xl p-5 shadow-sm hover:shadow-md transition-shadow cursor-pointer flex gap-5 items-center group"
    >
      {/* Mini Image Placeholder */}
      <div className="w-20 h-20 bg-gradient-to-br from-orange-100 to-amber-50 rounded-2xl flex items-center justify-center text-orange-400 shrink-0">
        <Building2 size={28} strokeWidth={1.5} />
      </div>

      {/*
        `min-w-0`: flex öğesi varsayılan olarak `min-width: auto` alır, yani uzun
        bir dükkan adı KÜÇÜLMEZ ve sağdaki puan rozetini karttan dışarı iter.
        Uzun isimler gerçek: "BagajPark Sultanahmet Emanet ve Valiz Depolama
        Noktası" gibi bir ad bu kartı bozuyordu.
      */}
      <div className="min-w-0 flex-1 flex flex-col gap-1">
        <div className="flex justify-between items-start gap-2">
          <h4 className="min-w-0 truncate font-bold text-gray-900 group-hover:text-orange-600 transition-colors">{name}</h4>
          <div className="shrink-0 flex items-center gap-1">
            <FavoriteButton shopId={id} className="!w-7 !h-7" />
            {rating > 0 ? (
              <span className="flex items-center gap-1 text-xs font-bold bg-orange-50 text-orange-600 px-2 py-1 rounded-lg">
                <Star size={12} fill="currentColor" />
                {formatDecimal(rating, locale)}
              </span>
            ) : null}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-gray-400 font-medium">
          <span className="inline-flex items-center gap-1">
            <MapPin size={12} />
            {t("away", { distance })}
          </span>
          {bagsAvailable != null ? (
            <span className="text-[10px] font-black uppercase tracking-tight text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md">
              {t("searchBagsAvailable", { count: bagsAvailable })}
            </span>
          ) : null}
        </div>

        <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-1.5 flex-wrap">
            <div className="flex items-center gap-1 text-[10px] text-green-600 font-bold uppercase tracking-wider">
              <Shield size={10} />
              {t("insured")}
            </div>
            <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded-md">
              {t("searchFreeCancelBadge")}
            </span>
            {/*
              Bu iki rozet burada İKİNCİ kez, elle çiziliyordu: "Doğr." ve
              "≤{n}dk" sabit TÜRKÇEYDİ, yani arama sonuçlarında 6 dilin
              hepsinde Türkçe görünüyordu. `TrustBadge` aynı ikiliyi zaten
              yerelleştirilmiş ve ölçüme bağlı biçimde çiziyor (P2-7); iki
              kopya olması hatanın kendisiydi.
            */}
            <VerifiedBadge isVerified={!!isVerified} />
            <ResponseTimeBadge minutes={responseTimeMinutes ?? null} />
          </div>

          <div className="text-right">
            {slotPrices ? (
              <div className="flex items-center gap-1.5">
                <span className="flex flex-col items-center"><span className="text-[9px] text-gray-400 font-bold uppercase">S</span><Money amount={slotPrices.s} compact className="text-xs font-black text-gray-900" /></span>
                <span className="text-gray-300 text-xs">|</span>
                <span className="flex flex-col items-center bg-orange-50/50 rounded-lg px-1.5 py-0.5"><span className="text-[9px] text-orange-500 font-bold uppercase">M/L</span><Money amount={slotPrices.m} compact className="text-sm font-black text-orange-600" /></span>
                <span className="text-gray-300 text-xs">|</span>
                <span className="flex flex-col items-center"><span className="text-[9px] text-gray-400 font-bold uppercase">XL</span><Money amount={slotPrices.xl} compact className="text-xs font-black text-gray-900" /></span>
              </div>
            ) : (
              <>
                <span className="text-[10px] text-gray-400 font-bold uppercase block -mb-0.5">{t("from")}</span>
                <Money amount={price} className="text-xl font-black text-gray-900" />
                <span className="text-[10px] text-gray-400 font-bold uppercase ml-1">/ {t("day")}</span>
              </>
            )}
          </div>
        </div>
        <div className="mt-3 flex items-center justify-between gap-3 border-t border-gray-100 pt-3">
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onClick?.();
            }}
            className="btn-ui btn-ui-sm bg-orange-600 text-white rounded-full px-4 py-2 text-[10px] font-black uppercase tracking-wider hover:bg-orange-700 transition-colors flex-1"
          >
            {t("bookNow")}
          </button>
          {lat && lng && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                window.open(`https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`, '_blank');
              }}
              className="btn-ui btn-ui-sm btn-ui-icon bg-gray-50 hover:bg-orange-50 text-gray-400 hover:text-orange-600 shrink-0"
              title={t("getDirections")}
            >
              <MapPin size={16} />
            </button>
          )}
          <ChevronRight size={16} className="text-orange-500 transition-transform group-hover:translate-x-1 shrink-0" />
        </div>
      </div>
    </motion.div>
  );
}
