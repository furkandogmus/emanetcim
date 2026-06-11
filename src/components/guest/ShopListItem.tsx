"use client";

import { Building2, MapPin, Star, Shield, Timer } from 'lucide-react';
import { useTranslations } from 'next-intl';
import FavoriteButton from '@/components/guest/FavoriteButton';

interface ShopListItemProps {
  id: string;
  name: string;
  rating: number;
  price: string;
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
  return (
    <div 
      data-testid="shop-list-item"
      onClick={onClick}
      className="bg-white border border-gray-100 rounded-3xl p-5 shadow-sm hover:shadow-md transition-all cursor-pointer flex gap-5 items-center group active:scale-[0.98]"
    >
      {/* Mini Image Placeholder */}
      <div className="w-20 h-20 bg-gradient-to-br from-orange-100 to-amber-50 rounded-2xl flex items-center justify-center text-orange-400 shrink-0">
        <Building2 size={28} strokeWidth={1.5} />
      </div>

      <div className="flex-1 flex flex-col gap-1">
        <div className="flex justify-between items-start">
          <h4 className="font-bold text-gray-900 group-hover:text-orange-600 transition-colors">{name}</h4>
          <div className="flex items-center gap-1">
            <FavoriteButton shopId={id} className="!w-7 !h-7" />
            <span className="flex items-center gap-1 text-xs font-bold bg-orange-50 text-orange-600 px-2 py-1 rounded-lg">
              <Star size={12} fill="currentColor" />
              {rating}
            </span>
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
          <div className="flex items-center gap-1.5 flex-wrap">
            <div className="flex items-center gap-1 text-[10px] text-green-600 font-bold uppercase tracking-wider">
              <Shield size={10} />
              {t("insured")}
            </div>
            <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded-md">
              {t("searchFreeCancelBadge")}
            </span>
            {isVerified && (
              <span className="inline-flex items-center gap-1 text-[10px] font-bold text-blue-700 bg-blue-50 px-1.5 py-0.5 rounded-md">
                <Shield size={10} />
                Doğr.
              </span>
            )}
            {responseTimeMinutes != null && (
              <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded-md">
                <Timer size={10} />
                ≤{responseTimeMinutes}dk
              </span>
            )}
          </div>
          
          <div className="flex items-center gap-3">
            {lat && lng && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  window.open(`https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`, '_blank');
                }}
                className="btn-ui btn-ui-sm btn-ui-icon bg-gray-50 hover:bg-orange-50 text-gray-400 hover:text-orange-600"
                title={t("getDirections")}
              >
                <MapPin size={16} />
              </button>
            )}
            <div className="text-right">
              {slotPrices ? (
                <div className="flex items-center gap-1.5">
                  <span className="flex flex-col items-center"><span className="text-[9px] text-gray-400 font-bold uppercase">S</span><span className="text-xs font-black text-gray-900">₺{slotPrices.s}</span></span>
                  <span className="text-gray-300 text-xs">|</span>
                  <span className="flex flex-col items-center bg-orange-50/50 rounded-lg px-1.5 py-0.5"><span className="text-[9px] text-orange-500 font-bold uppercase">M/L</span><span className="text-sm font-black text-orange-600">₺{slotPrices.m}</span></span>
                  <span className="text-gray-300 text-xs">|</span>
                  <span className="flex flex-col items-center"><span className="text-[9px] text-gray-400 font-bold uppercase">XL</span><span className="text-xs font-black text-gray-900">₺{slotPrices.xl}</span></span>
                </div>
              ) : (
                <>
                  <span className="text-[10px] text-gray-400 font-bold uppercase block -mb-0.5">{t("from")}</span>
                  <span className="text-xl font-black text-gray-900">₺{price}</span>
                  <span className="text-[10px] text-gray-400 font-bold uppercase ml-1">/ {t("day")}</span>
                </>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
