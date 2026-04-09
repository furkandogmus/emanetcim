import { MapPin, Star, Shield } from 'lucide-react';
import { useTranslations } from 'next-intl';

interface ShopListItemProps {
  name: string;
  rating: number;
  price: string;
  distance: string;
  onClick?: () => void;
}

/**
 * ShopListItem - Misafir Arama Sonucu Kartı
 * Minimalist, fiyat ve güven odaklı tasarım.
 */
export default function ShopListItem({ name, rating, price, distance, onClick }: ShopListItemProps) {
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

        <div className="flex items-center gap-2 text-xs text-gray-400 font-medium">
          <MapPin size={12} />
          <span>{t("away", { distance })}</span>
        </div>

        <div className="mt-2 flex justify-between items-baseline">
          <div className="flex items-center gap-1 text-[10px] text-green-600 font-bold uppercase tracking-wider">
            <Shield size={10} />
            {t("insured")}
          </div>
          <div className="text-right">
            <span className="text-xl font-black text-gray-900">₺{price}</span>
            <span className="text-[10px] text-gray-400 font-bold uppercase ml-1">/ {t("day")}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
