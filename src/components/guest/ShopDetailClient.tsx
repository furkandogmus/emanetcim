"use client";

import {
  ArrowLeft,
  MapPin,
  Star,
  Shield,
  Clock,
  Package,
  Sparkles,
  ExternalLink,
} from "lucide-react";
import { useEffect } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Link } from "@/i18n/routing";
import { roundedSlotPrices } from "@/lib/bag-pricing";
import type { PricingRules } from "@/lib/pricing-rules";
import { dateLocaleForUiLocale } from "@/lib/date-locale";
import {
  PLAUSIBLE_EVENTS,
  trackPlausibleEvent,
} from "@/lib/plausible-events";

export type ShopDetailClientShop = {
  id: string;
  name: string;
  address: string | null;
  latitude: number | null;
  longitude: number | null;
  capacity: number;
  rating: number | null;
  pricePerDay: number;
  hasRestroom: boolean;
  open247: boolean;
  openingTime: string | null;
  closingTime: string | null;
  reviews: Array<{
    id: string;
    rating: number;
    comment: string | null;
    createdAt: string;
    authorLabel: string;
  }>;
};

interface ShopDetailClientProps {
  shop: ShopDetailClientShop;
  pricingRules: PricingRules;
}

export default function ShopDetailClient({
  shop,
  pricingRules,
}: ShopDetailClientProps) {
  const t = useTranslations("Guest");
  const locale = useLocale();
  const dateLocale = dateLocaleForUiLocale(locale);
  const slot = roundedSlotPrices(shop.pricePerDay, pricingRules);
  const rating = shop.rating ?? 0;
  const mapsUrl =
    shop.latitude != null && shop.longitude != null
      ? `https://www.google.com/maps/dir/?api=1&destination=${shop.latitude},${shop.longitude}`
      : null;

  const hoursLabel = shop.open247
    ? t("open247")
    : shop.openingTime && shop.closingTime
      ? `${shop.openingTime} – ${shop.closingTime}`
      : "—";

  useEffect(() => {
    trackPlausibleEvent(PLAUSIBLE_EVENTS.ShopViewed, { shopId: shop.id });
  }, [shop.id]);

  return (
    <div className="min-h-screen bg-gray-50 pb-28">
      <div className="relative h-48 sm:h-56 bg-gradient-to-br from-orange-500 via-orange-600 to-amber-700">
        <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHZpZXdCb3g9IjAgMCA2MCA2MCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48ZyBmaWxsPSJub25lIiBmaWxsLXJ1bGU9ImV2ZW5vZGQiPjxwYXRoIGQ9Ik0zNiAxOGMzLjMxIDAgNiAyLjY5IDYgNnMtMi42OSA2LTYgNi02LTIuNjktNi02IDIuNjktNiA2LTYiIGZpbGw9IiNmZmYiIGZpbGwtb3BhY2l0eT0iLjA4Ii8+PC9nPjwvc3ZnPg==')] opacity-40" />
        <div className="absolute top-4 left-4 z-10">
          <Link
            href="/search"
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-full bg-white/95 text-gray-900 text-xs font-black uppercase tracking-wider shadow-lg hover:bg-white transition-colors"
          >
            <ArrowLeft size={16} />
            {t("shopDetailBackSearch")}
          </Link>
        </div>
        <div className="absolute bottom-0 left-0 right-0 p-6 bg-gradient-to-t from-black/50 to-transparent">
          <div className="flex items-start gap-3 text-white">
            <div className="w-14 h-14 rounded-2xl bg-white/20 backdrop-blur flex items-center justify-center shrink-0">
              <MapPin size={28} strokeWidth={1.5} />
            </div>
            <div className="min-w-0">
              <h1 className="text-xl sm:text-2xl font-black tracking-tight leading-tight">
                {shop.name}
              </h1>
              {shop.address ? (
                <p className="text-sm text-white/85 mt-1 line-clamp-2">
                  {shop.address}
                </p>
              ) : null}
              <div className="flex items-center gap-2 mt-2">
                <span className="inline-flex items-center gap-1 text-xs font-black bg-white/20 px-2 py-1 rounded-lg">
                  <Star size={12} fill="currentColor" />
                  {rating.toFixed(1)}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <main className="max-w-lg mx-auto px-4 -mt-4 relative z-[1] flex flex-col gap-4">
        <section className="bg-white rounded-3xl p-6 shadow-xl shadow-gray-200/50 border border-gray-100">
          <h2 className="text-[10px] font-black uppercase tracking-widest text-gray-400 mb-4">
            {t("shopDetailBagPrices")}
          </h2>
          <div className="grid grid-cols-3 gap-3 text-center">
            <div className="rounded-2xl bg-gray-50 p-3 border border-gray-100">
              <p className="text-[9px] font-bold text-gray-400 uppercase">S</p>
              <p className="text-lg font-black text-gray-900">₺{slot.s}</p>
            </div>
            <div className="rounded-2xl bg-orange-50 p-3 border border-orange-100">
              <p className="text-[9px] font-bold text-orange-600 uppercase">
                M/L
              </p>
              <p className="text-lg font-black text-orange-700">₺{slot.m}</p>
            </div>
            <div className="rounded-2xl bg-gray-50 p-3 border border-gray-100">
              <p className="text-[9px] font-bold text-gray-400 uppercase">XL</p>
              <p className="text-lg font-black text-gray-900">₺{slot.xl}</p>
            </div>
          </div>
          <p className="text-[10px] text-gray-400 mt-3 text-center">
            {t("perBag")} / {t("day")}
          </p>
        </section>

        <section className="bg-white rounded-3xl p-5 shadow-sm border border-gray-100 flex flex-wrap gap-3">
          <div className="flex items-center gap-2 text-xs font-bold text-gray-700 min-w-[140px]">
            <Clock size={18} className="text-orange-500 shrink-0" />
            <div>
              <p className="text-[9px] font-black uppercase text-gray-400">
                {t("shopDetailHours")}
              </p>
              <p>{hoursLabel}</p>
            </div>
          </div>
          <div className="flex items-center gap-2 text-xs font-bold text-gray-700 min-w-[140px]">
            <Package size={18} className="text-orange-500 shrink-0" />
            <div>
              <p className="text-[9px] font-black uppercase text-gray-400">
                {t("shopDetailCapacityLabel")}
              </p>
              <p>{shop.capacity}</p>
            </div>
          </div>
          <div className="flex items-start gap-2 text-xs font-bold text-emerald-700 w-full sm:w-auto sm:max-w-[220px]">
            <Shield size={18} className="shrink-0 mt-0.5" aria-hidden />
            <div>
              <span>{t("insuranceIncluded")}</span>
              <p className="mt-1 text-[9px] font-medium leading-relaxed text-gray-500 normal-case">
                {t("shopDetailInsuranceHint")}{" "}
                <Link href="/faq" className="font-bold text-orange-600 hover:underline">
                  {t("checkoutFaqLink")}
                </Link>
              </p>
            </div>
          </div>
          {shop.hasRestroom ? (
            <div className="flex items-center gap-2 text-xs font-bold text-gray-600">
              <Sparkles size={16} className="text-orange-500" />
              {t("restroom")}
            </div>
          ) : null}
        </section>

        {mapsUrl ? (
          <section className="bg-white rounded-3xl p-5 shadow-sm border border-gray-100">
            <h2 className="text-[10px] font-black uppercase tracking-widest text-gray-400 mb-3">
              {t("shopDetailLocation")}
            </h2>
            <a
              href={mapsUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-center gap-2 w-full py-4 rounded-2xl bg-gray-900 text-white text-xs font-black uppercase tracking-wider hover:bg-black transition-colors"
            >
              <ExternalLink size={16} />
              {t("getDirections")}
            </a>
          </section>
        ) : null}

        <section className="bg-white rounded-3xl p-5 shadow-sm border border-gray-100">
          <h2 className="text-[10px] font-black uppercase tracking-widest text-gray-400 mb-4">
            {t("shopDetailReviews")} ({shop.reviews.length})
          </h2>
          {shop.reviews.length === 0 ? (
            <p className="text-sm text-gray-500 font-medium">
              {t("shopDetailNoReviews")}
            </p>
          ) : (
            <ul className="flex flex-col gap-4">
              {shop.reviews.map((r) => (
                <li
                  key={r.id}
                  className="border-b border-gray-50 last:border-0 pb-4 last:pb-0"
                >
                  <div className="flex items-center justify-between gap-2 mb-1">
                    <span className="text-sm font-black text-gray-900">
                      {r.authorLabel || t("guestDefaultName")}
                    </span>
                    <span className="flex items-center gap-0.5 text-xs font-bold text-orange-600">
                      <Star size={12} fill="currentColor" />
                      {r.rating}
                    </span>
                  </div>
                  {r.comment ? (
                    <p className="text-sm text-gray-600 leading-relaxed">
                      {r.comment}
                    </p>
                  ) : null}
                  <p className="text-[10px] text-gray-400 mt-2 font-medium">
                    {new Date(r.createdAt).toLocaleDateString(dateLocale, {
                      year: "numeric",
                      month: "short",
                      day: "numeric",
                    })}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </section>
      </main>

      <div className="fixed bottom-0 left-0 right-0 p-4 pb-6 bg-white/95 backdrop-blur-xl border-t border-gray-100 z-20">
        <div className="max-w-lg mx-auto">
          <Link
            href={`/checkout/${shop.id}`}
            data-testid="shop-book-now"
            className="flex w-full items-center justify-center gap-2 py-4 rounded-2xl bg-orange-600 text-white text-sm font-black uppercase tracking-widest shadow-lg shadow-orange-200 hover:bg-orange-700 transition-colors active:scale-[0.99]"
          >
            {t("shopDetailBookNow")}
          </Link>
        </div>
      </div>
    </div>
  );
}
