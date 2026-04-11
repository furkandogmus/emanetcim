"use client";

import { MapPin, Star, Shield } from 'lucide-react';
import { useTranslations } from 'next-intl';

interface ShopListItemProps {
  name: string;
  rating: number;
  price: string;
  distance: string;
  lat?: number;
  lng?: number;
  /** Seçilen tarih aralığında kalan tahmini kapasite (valiz adedi) */
  bagsAvailable?: number;
  onClick?: () => void;
}

/**
 * ShopListItem - Misafir Arama Sonucu Kartı
 * Minimalist, fiyat ve güven odaklı tasarım.
 */
export default function ShopListItem({
  name,
  rating,
  price,
  distance,
  lat,
  lng,
  bagsAvailable,
  onClick,
}: ShopListItemProps) {
  const t = useTranslations('Guest');
  return (
    <div 
      data-testid="shop-list-item"
      onClick={onClick}
      className="bg-white border border-gray-100 rounded-3xl p-5 shadow-sm hover:shadow-md transition-all cursor-pointer flex gap-5 items-center group active:scale-[0.98]"
    >
      {/* Mini Image Placeholder */}
      <div className="w-20 h-20 bg-gray-100 rounded-2xl flex items-center justify-center text-gray-300">
        <MapPin size={32} strokeWidth={1.5} />
      </div>

      <div className="flex-1 flex flex-col gap-1">
        <div className="flex justify-between items-start">
          <h4 className="font-bold text-gray-900 group-hover:text-orange-600 transition-colors">{name}</h4>
          <div className="flex items-center gap-1 text-xs font-bold bg-orange-50 text-orange-600 px-2 py-1 rounded-lg">
            <Star size={12} fill="currentColor" />
            {rating}
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

        <div className="mt-3 flex justify-between items-center">
          <div className="flex items-center gap-1 text-[10px] text-green-600 font-bold uppercase tracking-wider">
            <Shield size={10} />
            {t("insured")}
          </div>
          
          <div className="flex items-center gap-3">
            {lat && lng && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  window.open(`https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`, '_blank');
                }}
                className="p-2 bg-gray-50 hover:bg-orange-50 text-gray-400 hover:text-orange-600 rounded-xl transition-all"
                title={t("getDirections")}
              >
                <MapPin size={16} />
              </button>
            )}
            <div className="text-right">
              <span className="text-xl font-black text-gray-900">₺{price}</span>
              <span className="text-[10px] text-gray-400 font-bold uppercase ml-1">/ {t("day")}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
