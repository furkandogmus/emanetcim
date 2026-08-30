"use client";

import {
  ArrowLeft,
  MapPin,
  Building2,
  Star,
  Shield,
  Clock,
  Package,
  Sparkles,
  ExternalLink,
} from "lucide-react";
import { useEffect, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Link, useRouter } from "@/i18n/routing";
import { useSwipeBack } from "@/lib/hooks/useSwipeBack";
import { hapticMedium } from "@/lib/haptic";
import { useShare } from "@/lib/hooks/useShare";
import { roundedSlotPrices } from "@/lib/bag-pricing";
import type { PricingRules } from "@/lib/pricing-rules";
import { bcp47ForUiLocale } from "@/lib/intl-locale";
import {
  PLAUSIBLE_EVENTS,
  trackPlausibleEvent,
} from "@/lib/plausible-events";
import { TrustBadges } from "@/components/common/TrustBadge";
import FavoriteButton from "@/components/guest/FavoriteButton";
import ShopGallery from "@/components/guest/ShopGallery";
import { isInsuranceEnabled } from "@/lib/commerce-context";
import Money from "@/components/common/Money";
import { formatDecimal } from "@/lib/currency";
import PrelaunchNotifyButton from "@/components/guest/PrelaunchNotifyButton";
import PrelaunchDemandPanel from "@/components/guest/PrelaunchDemandPanel";

/*
  CTA sinif dizgeleri TEK YERDE: rezervasyon dali ile talep-testi dali ayni
  dugmeyi cizmek zorunda. Kopyalansaydi biri stil duzeltmesini alir digeri
  geride kalirdi -- ve `design-tokens` mandali kopyayi zaten sabit stil borcu
  olarak sayiyor.
*/
const MOBILE_CTA_CLASS =
  "btn-ui btn-ui-lg btn-ui-primary rounded-2xl px-8 active:scale-[0.97] transition-transform";
const MAIN_CTA_CLASS =
  "flex w-full items-center justify-center gap-2 py-4 rounded-2xl id-accent-bg text-white text-sm id-eyebrow shadow-lg transition-all active:scale-[0.97]";

export type ShopDetailClientShop = {
  id: string;
  name: string;
  address: string | null;
  image: string | null;
  description: string | null;
  latitude: number | null;
  longitude: number | null;
  capacity: number;
  rating: number | null;
  pricePerDay: number;
  hasRestroom: boolean;
  hasCctv: boolean;
  hasClimateControl: boolean;
  acceptsLargeItems: boolean;
  open247: boolean;
  openingTime: string | null;
  closingTime: string | null;
  isVerified: boolean;
  /** Talep testi noktasi: rezervasyon alinmaz, CTA "haber ver"e doner. */
  isPrelaunch: boolean;
  responseTimeMinutes: number | null;
  reviews: Array<{
    id: string;
    rating: number;
    comment: string | null;
    createdAt: string;
    authorLabel: string;
  }>;
  images: Array<{
    id: string;
    url: string;
  }>;
};

interface ShopDetailClientProps {
  shop: ShopDetailClientShop;
  pricingRules: PricingRules;
  /** Talep testi noktasi icin "kac kisi istiyor"; isletilen dukkanda 0 ve kullanilmaz. */
  prelaunchWantCount: number;
}

export default function ShopDetailClient({
  shop,
  pricingRules,
  prelaunchWantCount,
}: ShopDetailClientProps) {
  const router = useRouter();
  const t = useTranslations("Guest");
  /**
   * Sigorta gerçekten var mı? Zaten elimizde olan `pricingRules`'tan türüyor —
   * ayrı bir sorgu veya bağlam gerekmiyor (P1-20).
   */
  const insuranceEnabled = isInsuranceEnabled(pricingRules);
  const locale = useLocale();
  const dateLocale = bcp47ForUiLocale(locale);
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
  /**
   * Bu blok eskiden `locale === "tr" ? {...} : {...}` idi, yani dükkan detay
   * sayfasındaki 13 metin diğer 12 dilde İNGİLİZCE çıkıyordu — üstelik bu sayfa
   * dönüşüm hunisinin içinde. Turist odaklı bir üründe Türkçe dışı diller tam da
   * hedef kitle.
   *
   * `bagajPark` bilerek çevrilmiyor: marka adı.
   */
  const mobileCopy = {
    bagajPark: "BagajPark",
    verifiedPartner: t("shopVerifiedPartner"),
    insuredStorage: t("shopInsuredStorage"),
    premiumAmenities: t("shopPremiumAmenities"),
    cctv: t("shopCctv"),
    climate: t("shopClimate"),
    largeItems: t("shopLargeItems"),
    sealProvided: t("shopSealProvided"),
    weekDays: t("shopWeekDays"),
    weekEnd: t("shopWeekEnd"),
    seeAll: t("shopSeeAll"),
    perDay: t("shopPerDay"),
  };

  useEffect(() => {
    trackPlausibleEvent(PLAUSIBLE_EVENTS.ShopViewed, { shopId: shop.id });
  }, [shop.id]);

  useSwipeBack({ onSwipeBack: () => router.push("/search") });

  const { share } = useShare();
  const shareUrl = typeof window !== "undefined" ? window.location.href : "";
  const [showAllReviews, setShowAllReviews] = useState(false);

  const [checkoutParams] = useState(() => {
    try {
      const raw = sessionStorage.getItem("bagajpark_search_params");
      if (raw) {
        const p = JSON.parse(raw);
        const params = new URLSearchParams();
        if (p.checkIn) params.set("checkIn", p.checkIn);
        if (p.checkOut) params.set("checkOut", p.checkOut);
        if (p.bags) params.set("bags", p.bags);
        return "?" + params.toString();
      }
    } catch {}
    return "";
  });

  return (
    <div className="bg-gray-50 pb-28">
      <div className="md:hidden">
        <div className={`relative h-[360px] ${shop.image || shop.images.length > 0 ? '' : 'bg-gradient-to-br from-orange-500 via-amber-500 to-orange-600 flex items-center justify-center'}`}>
          {shop.images.length > 0 ? (
            <ShopGallery images={shop.images} shopName={shop.name} />
          ) : shop.image ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={shop.image} alt={shop.name} className="w-full h-full object-cover" />
          ) : (
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_20%,rgba(255,255,255,0.25),transparent_50%)]" />
          )}
          {!shop.image && shop.images.length === 0 && (
            <div className="relative z-0 flex flex-col items-center gap-3 text-white/90">
              <Building2 size={80} strokeWidth={1} />
              <span className="text-6xl font-black tracking-tighter opacity-30">{shop.name.charAt(0).toUpperCase()}</span>
            </div>
          )}
          <div className="absolute top-4 left-4 right-4 z-10 flex items-center justify-between">
            <Link
              href="/search"
              className="inline-flex items-center gap-2 rounded-full bg-white/90 px-3 py-2 text-xs font-black text-gray-900 shadow"
            >
              <ArrowLeft size={15} />
              {mobileCopy.bagajPark}
            </Link>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => share({ title: shop.name, text: `${shop.name} — BagajPark`, url: shareUrl })}
                className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-white/90 text-gray-900 shadow active:scale-90 transition-transform"
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8"/><polyline points="16 6 12 2 8 6"/><line x1="12" y1="2" x2="12" y2="15"/></svg>
              </button>
              <span className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-white/90 text-gray-900 shadow">
                <MapPin size={16} />
              </span>
            </div>
          </div>
          <div className="absolute inset-x-4 -bottom-12 z-10 rounded-2xl bg-white p-5 shadow-2xl shadow-gray-300/60">
            <div className="flex items-start justify-between gap-3">
              <h1 className="min-w-0 flex-1 break-words text-[1.65rem] sm:text-[1.9rem] leading-[1.05] font-black text-gray-900">
                {shop.name}
              </h1>
              <div className="shrink-0 flex items-center gap-2">
                <FavoriteButton shopId={shop.id} />
              {rating > 0 ? (
                <div className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-black text-emerald-700">
                  <Star size={12} fill="currentColor" />
                  {formatDecimal(rating, locale)}
                </div>
              ) : null}
              </div>
            </div>
            <p className="mt-2 text-sm text-gray-500 flex items-center gap-1.5">
              <MapPin size={14} /> {shop.address?.split(",")[0] || t("cityFallback")}
            </p>
            <div className="mt-3 flex items-center gap-2">
              <TrustBadges isVerified={shop.isVerified} responseTimeMinutes={shop.responseTimeMinutes} />
            </div>
            <div className="mt-3 grid grid-cols-2 gap-2">
              <span className="rounded-xl bg-indigo-50 px-3 py-2 text-xs font-black uppercase tracking-[0.14em] text-indigo-700">
                {mobileCopy.verifiedPartner}
              </span>
              {/*
                SİGORTA ROZETLERİ YALNIZCA GERÇEKTEN SİGORTA VARSA.

                2026-08-22'de canlı `insuranceFeeTry = 0` iken bu rozetler
                gösteriliyordu — karşılığı olmayan bir güvence vaadi. Bir bavul
                kaybolduğunda platformun neye dayanarak ödeme yapacağı belirsizdi
                (P1-20). "10.000 TL Garanti" rozeti de aynı hata sınıfını
                taşıyordu, aynı kontrole eklendi. Ücret belirlendiği an rozetler
                kendiliğinden geri gelir; hiçbir kod değişikliği gerekmez.
              */}
              {insuranceEnabled ? (
                <>
                  <span className="rounded-xl bg-emerald-50 px-3 py-2 text-xs font-black uppercase tracking-[0.14em] text-emerald-700">
                    {mobileCopy.insuredStorage}
                  </span>
                  <span className="rounded-xl bg-rose-50 px-3 py-2 text-xs font-black uppercase tracking-[0.14em] text-rose-700">
                    {t("guaranteeBadge")}
                  </span>
                </>
              ) : null}
              <span className="rounded-xl bg-amber-50 px-3 py-2 text-xs font-black uppercase tracking-[0.14em] text-amber-700">
                {t("searchFreeCancelBadge")}
              </span>
            </div>
          </div>
        </div>

        <main className="px-4 pt-16 space-y-5">
        {/*
          TALEP PANELI EN USTTE. Onceki halinde tek erisim, sayfanin DIBINDEKI
          yapiskan cubuktaki dugmeydi ve e-posta formu onun actigi modalin
          icindeydi -- olcmek istedigimiz sinyalin onunde iki adim vardi.
          Burada, basligin hemen altinda, tek tikla sayilir.
        */}
        {shop.isPrelaunch ? (
          <PrelaunchDemandPanel
            shopId={shop.id}
            shopName={shop.name}
            initialWantCount={prelaunchWantCount}
          />
        ) : null}
          <section>
            <h2 className="text-2xl font-black text-gray-900 mb-3">{mobileCopy.premiumAmenities}</h2>
            <div className="grid grid-cols-2 gap-3">
              {shop.hasCctv && (
                <div className="rounded-3xl border border-gray-100 bg-white p-4">
                  <p className="text-xs font-black uppercase text-gray-500">{mobileCopy.cctv}</p>
                </div>
              )}
              {shop.hasClimateControl && (
                <div className="rounded-3xl border border-gray-100 bg-white p-4">
                  <p className="text-xs font-black uppercase text-gray-500">{mobileCopy.climate}</p>
                </div>
              )}
              {shop.acceptsLargeItems && (
                <div className="rounded-3xl border border-gray-100 bg-white p-4">
                  <p className="text-xs font-black uppercase text-gray-500">{mobileCopy.largeItems}</p>
                </div>
              )}
              <div className="rounded-3xl border border-gray-100 bg-white p-4">
                <p className="text-xs font-black uppercase text-gray-500">{mobileCopy.sealProvided}</p>
              </div>
            </div>
          </section>

          {shop.description && (
            <section className="rounded-2xl border border-gray-100 bg-white p-5">
              <h2 className="text-xl font-black text-gray-900 mb-3">{t("shopDetailAbout")}</h2>
              <p className="text-sm leading-relaxed text-gray-600">{shop.description}</p>
            </section>
          )}

          <section className="rounded-2xl border border-gray-100 bg-[#f2f4ff] p-5">
            <h2 className="text-xl font-black text-gray-900 mb-3">{t("shopDetailHours")}</h2>
            <div className="space-y-2 text-sm font-bold text-gray-700">
              <div className="flex justify-between"><span>{mobileCopy.weekDays}</span><span>{hoursLabel}</span></div>
              <div className="flex justify-between"><span>{mobileCopy.weekEnd}</span><span>{hoursLabel}</span></div>
            </div>
            {mapsUrl ? (
              <a
                href={mapsUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-4 block rounded-2xl border border-gray-200 bg-white p-4 text-center text-xs font-black uppercase tracking-wider text-gray-700"
              >
                {t("getDirections")}
              </a>
            ) : null}
          </section>

          <section>
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-2xl font-black text-gray-900">{t("shopDetailReviews")}</h2>
              {/*
                Onceden bu her zaman gorunen, hicbir seye baglanmayan sabit
                bir `<span>` idi -- "Tumunu Gor" yaziyordu ama tiklaninca
                hicbir sey olmuyordu, sifir yorumda bile gosteriliyordu.
                Simdi yalnizca gosterilecek fazladan yorum varken cikiyor
                ve masaustu surumunun zaten yaptigi gibi tumunu acar.
              */}
              {shop.reviews.length > 1 ? (
                <button
                  type="button"
                  onClick={() => setShowAllReviews((v) => !v)}
                  className="text-xs font-black text-orange-600 uppercase tracking-wider"
                >
                  {showAllReviews ? t("shopDetailShowLess") : mobileCopy.seeAll}
                </button>
              ) : null}
            </div>
            {shop.reviews.length === 0 ? (
              <p className="rounded-3xl bg-white p-4 text-sm text-gray-500">{t("shopDetailNoReviews")}</p>
            ) : (
              <div className="flex flex-col gap-3">
                {(showAllReviews ? shop.reviews : shop.reviews.slice(0, 1)).map((r) => (
                  <div key={r.id} className="rounded-3xl border border-gray-100 bg-white p-4">
                    <div className="flex items-center justify-between gap-2">
                      <p className="font-black text-gray-900">{r.authorLabel || t("guestDefaultName")}</p>
                      <span className="flex items-center gap-0.5 text-xs font-bold text-orange-600">
                        <Star size={12} fill="currentColor" />
                        {r.rating}
                      </span>
                    </div>
                    {r.comment ? (
                      <p className="mt-2 text-sm leading-relaxed text-gray-600">{r.comment}</p>
                    ) : null}
                  </div>
                ))}
              </div>
            )}
          </section>
        </main>

        {/* pb: mobil alt nav (~80px) bu bar'in ustune biniyordu; CheckoutClient.tsx'teki
            sticky footer ile ayni 6rem offset kullaniliyor. */}
        <div className="fixed inset-x-0 bottom-0 z-20 border-t border-gray-100 bg-white/95 px-4 pb-[calc(env(safe-area-inset-bottom)+6rem)] pt-3 backdrop-blur-xl">
          <div className="mx-auto flex max-w-lg items-center gap-3">
            {/*
              TALEP TESTİ NOKTASINDA FİYAT YAZILMAZ.

              Bu noktalarda `pricePerDay` şema varsayılanıdır (₺50) — bir esnafla
              anlaşılmadığı için gerçek bir fiyat yok. Yanında "Haber ver" düğmesi
              dururken bir tutar basmak, tutamayacağımız bir söz vermek olurdu; üstelik
              nokta Tokyo'da da olabilir, o zaman yanlış para biriminde bir söz.
              Yerine, hâlâ kullanılmayan `prelaunchBadge` metni geçiyor.
            */}
            <div className="flex-1">
              {!shop.isPrelaunch && (
                <p className="text-xs id-eyebrow text-gray-400">{t("perBag")}</p>
              )}
              <p className="text-3xl font-black text-gray-900">
                {shop.isPrelaunch ? (
                  t("prelaunchBadge")
                ) : (
                  <>
                    {/*
                      ÇİFT PARA İŞARETİ HATASI DÜZELTİLDİ (2026-08-22).
                      `mobilePricePerBag` zaten `formatTryCurrency` çıktısıydı ("₺50,00")
                      ve başına bir `₺` daha ekleniyordu — yapışkan fiyat çubuğunda
                      "₺₺50,00" yazıyordu.
                    */}
                    <Money amount={slot.m} /> <span className="text-base text-gray-500">{mobileCopy.perDay}</span>
                  </>
                )}
              </p>
            </div>
            {shop.isPrelaunch ? (
              <PrelaunchNotifyButton
                shopId={shop.id}
                shopName={shop.name}
                className={MOBILE_CTA_CLASS}
              />
            ) : (
            <Link
              href={`/checkout/${shop.id}${checkoutParams}`}
              data-testid="shop-book-now-mobile"
              className={MOBILE_CTA_CLASS}
              onClick={() => hapticMedium()}
            >
              {t("bookNow")}
            </Link>
            )}
          </div>
        </div>
      </div>

      <div className="hidden md:block">
      {shop.images.length > 0 ? (
        <ShopGallery images={shop.images} shopName={shop.name} />
      ) : (
      <div className="relative h-48 sm:h-56 bg-gradient-to-br from-orange-500 via-orange-600 to-amber-700">
        <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHZpZXdCb3g9IjAgMCA2MCA2MCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48ZyBmaWxsPSJub25lIiBmaWxsLXJ1bGU9ImV2ZW5vZGQiPjxwYXRoIGQ9Ik0zNiAxOGMzLjMxIDAgNiAyLjY5IDYgNnMtMi42OSA2LTYgNi02LTIuNjktNi02IDIuNjktNiA2LTYiIGZpbGw9IiNmZmYiIGZpbGwtb3BhY2l0eT0iLjA4Ii8+PC9nPjwvc3ZnPg==')] opacity-40" />
        <div className="absolute top-4 left-4 right-4 z-10 flex items-center justify-between">
          <Link
            href="/search"
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-full bg-white/95 text-gray-900 text-xs font-black uppercase tracking-wider shadow-lg hover:bg-white transition-colors"
          >
            <ArrowLeft size={16} />
            {t("shopDetailBackSearch")}
          </Link>
          <button
            type="button"
            onClick={() => share({ title: shop.name, text: `${shop.name} — BagajPark`, url: shareUrl })}
            className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-white/95 text-gray-900 shadow-lg hover:bg-white transition-colors active:scale-90"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8"/><polyline points="16 6 12 2 8 6"/><line x1="12" y1="2" x2="12" y2="15"/></svg>
          </button>
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
                {rating > 0 ? (
                  <span className="inline-flex items-center gap-1 text-xs font-black bg-white/20 px-2 py-1 rounded-lg">
                    <Star size={12} fill="currentColor" />
                    {formatDecimal(rating, locale)}
                  </span>
                ) : null}
              </div>
            </div>
          </div>
        </div>
      </div>
      )}

      <main className="max-w-lg mx-auto px-4 -mt-4 relative z-[1] flex flex-col gap-4">
      {/*
        TALEP PANELI EN USTTE. Onceki halinde tek erisim, sayfanin DIBINDEKI
        yapiskan cubuktaki dugmeydi ve e-posta formu onun actigi modalin
        icindeydi -- olcmek istedigimiz sinyalin onunde iki adim vardi.
        Burada, basligin hemen altinda, tek tikla sayilir.
      */}
      {shop.isPrelaunch ? (
        <PrelaunchDemandPanel
          shopId={shop.id}
          shopName={shop.name}
          initialWantCount={prelaunchWantCount}
        />
      ) : null}
        {/* Aynı gerekçe: talep testi noktasında valiz fiyat tablosu gösterilmez. */}
        {!shop.isPrelaunch && (
        <section className="bg-white rounded-3xl p-6 shadow-xl shadow-gray-200/50 border border-gray-100">
          <h2 className="id-eyebrow text-gray-400 mb-4">
            {t("shopDetailBagPrices")}
          </h2>
          <div className="grid grid-cols-3 gap-3 text-center">
            <div className="rounded-2xl bg-gray-50 p-3 border border-gray-100">
              <p className="text-[9px] font-bold text-gray-400 uppercase">S</p>
              <p className="text-lg font-black text-gray-900"><Money amount={slot.s} /></p>
            </div>
            <div className="rounded-2xl bg-orange-50 p-3 border border-orange-100">
              <p className="text-[9px] font-bold text-orange-600 uppercase">
                M/L
              </p>
              <p className="text-lg font-black text-orange-700"><Money amount={slot.m} /></p>
            </div>
            <div className="rounded-2xl bg-gray-50 p-3 border border-gray-100">
              <p className="text-[9px] font-bold text-gray-400 uppercase">XL</p>
              <p className="text-lg font-black text-gray-900"><Money amount={slot.xl} /></p>
            </div>
          </div>
          <p className="text-[10px] text-gray-400 mt-3 text-center">
            {t("perBag")} / {t("day")}
          </p>
        </section>
        )}

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
          {/* Mobil rozetlerle ayni kural (yukarida): sigorta karsiligi yokken
              "Dahil" demek P1-20 sinifi bir hata. Bu blok o korumaya
              alinmamisti. */}
          {insuranceEnabled ? (
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
          ) : null}
          {shop.hasRestroom ? (
            <div className="flex items-center gap-2 text-xs font-bold text-gray-600">
              <Sparkles size={16} className="text-orange-500" />
              {t("restroom")}
            </div>
          ) : null}
        </section>

        {mapsUrl ? (
          <section className="bg-white rounded-3xl p-5 shadow-sm border border-gray-100">
            <h2 className="id-eyebrow text-gray-400 mb-3">
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
          <h2 className="id-eyebrow text-gray-400 mb-4">
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
          {shop.isPrelaunch ? (
            <PrelaunchNotifyButton
              shopId={shop.id}
              shopName={shop.name}
              className={MAIN_CTA_CLASS}
            />
          ) : (
          <Link
            href={`/checkout/${shop.id}${checkoutParams}`}
            data-testid="shop-book-now"
            className={MAIN_CTA_CLASS}
            onClick={() => hapticMedium()}
          >
            {t("shopDetailBookNow")}
          </Link>
          )}
        </div>
      </div>
      </div>
    </div>
  );
}
