"use client";

import { useTranslations } from "next-intl";
import { useLocale } from "next-intl";
import { useState, useMemo, useCallback, useEffect, useRef } from "react";
import { usePullToRefresh } from "@/lib/hooks/usePullToRefresh";
import {
  Search as SearchIcon,
  ChevronLeft,
  MapPin,
  Minus,
  Plus,
  SlidersHorizontal,
  Crosshair,
  ArrowUpDown,
} from "lucide-react";
import DateTimePicker from "@/components/ui/DateTimePicker";
import BottomSheet from "@/components/ui/BottomSheet";
import { useMediaQuery } from "@/lib/hooks/useMediaQuery";
import { Link } from "@/i18n/routing";
import { useRouter } from "@/i18n/routing";
import ShopListItem from "@/components/guest/ShopListItem";
import dynamic from "next/dynamic";
import { motion, AnimatePresence } from "framer-motion";
import type { ShopSearchHit } from "@/services/ShopService";
/**
 * Saat dilimi: rezervasyon saatleri DÜKKANIN yerel saatidir, cihazınkinin değil.
 * Ayrıntı ve ölçülen hata: `src/lib/datetime-local.ts` →
 * `parseDatetimeLocalInTimeZone`.
 */
import {
  parseDatetimeLocalInTimeZone,
  toDatetimeLocalValueInTimeZone,
} from "@/lib/datetime-local";
import { refreshSearchShopsAction } from "@/actions/search-shops";
import { geocodeSearchCenterAction } from "@/actions/geocode-search-center";
import { toast } from "sonner";
import { STORAGE_CITIES } from "@/lib/storage-cities";
import {
  PLAUSIBLE_EVENTS,
  trackPlausibleEvent,
} from "@/lib/plausible-events";

/**
 * Harita AYRI BİR PARÇAYA alındı (performans).
 *
 * `maplibre-gl` derlenmiş hâlde ~1 MB ve uygulamanın EN BÜYÜK istemci parçası.
 * Statik `import` ile `/search` sayfasının ilk JS yükünün içindeydi: liste
 * paneli — misafirin gerçekte dokunduğu yüzey — harita motorunun tamamı
 * indirilip ayrıştırılmadan etkileşime hazır olmuyordu. Harita `absolute
 * inset-0` ile listenin ARKASINDA duruyor; hidrasyondan sonra gelmesi
 * kullanıcının gördüğü hiçbir şeyi geciktirmez.
 *
 * `ssr: false`: harita bir `<canvas>`; sunucuda çizilecek içeriği yok, SEO
 * değeri taşımıyor (şehir sayfalarının metni ayrı).
 */
const SearchMap = dynamic(() => import("@/components/guest/SearchMap"), {
  ssr: false,
  loading: () => (
    <div className="h-full w-full bg-gray-100" aria-hidden="true" />
  ),
});

type Tab = "nearby" | "all";

const MAX_SEARCH_BAGS = 20;

interface SearchClientProps {
  initialNearby: ShopSearchHit[];
  initialAll: ShopSearchHit[];
  defaultCheckInIso: string;
  defaultCheckOutIso: string;
  /** URL ?q= ile şehir sayfalarından gelen metin filtresi */
  initialSearchQuery?: string;
  /** URL ?lat=&lng= veya şehir sayfası; yakın liste ve yenileme merkezi */
  searchCenter: { lat: number; lng: number };
}

/**
 * Arama: tarih / valiz + müsaitlik; filtreler; mesafe; harita.
 */
export default function SearchClient({
  initialNearby,
  initialAll,
  defaultCheckInIso,
  defaultCheckOutIso,
  initialSearchQuery = "",
  searchCenter,
}: SearchClientProps) {
  const t = useTranslations("Guest");
  const tCommon = useTranslations("Common");
  const tErr = useTranslations("Errors");
  const locale = useLocale();
  const router = useRouter();
  const [searchQuery, setSearchQuery] = useState(initialSearchQuery);
  const [minRating, setMinRating] = useState(0);
  const [maxPrice, setMaxPrice] = useState(500);
  const [open247Only, setOpen247Only] = useState(false);
  const [hasRestroom, setHasRestroom] = useState(false);
  const [hasCctv, setHasCctv] = useState(false);
  const [hasClimateControlFilter, setHasClimateControlFilter] = useState(false);
  const [acceptsLargeItemsFilter, setAcceptsLargeItemsFilter] = useState(false);
  const [sortBy, setSortBy] = useState<string>("distance");
  const [gpsLocating, setGpsLocating] = useState(false);
  const [activeTab, setActiveTab] = useState<Tab>("nearby");

  const [nearbyList, setNearbyList] = useState<ShopSearchHit[]>(initialNearby);
  const [allList, setAllList] = useState<ShopSearchHit[]>(initialAll);

  const [checkInLocal, setCheckInLocal] = useState("");
  const [checkOutLocal, setCheckOutLocal] = useState("");
  const [datesReady, setDatesReady] = useState(false);
  const [requestedBags, setRequestedBags] = useState(1);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [filterDirty, setFilterDirty] = useState(false);
  const [dynamicCenter, setDynamicCenter] = useState(searchCenter);
  const [resolvedPlaceLabel, setResolvedPlaceLabel] = useState<string | null>(null);
  const [panelOpen, setPanelOpen] = useState(true);
  /**
   * Tarih/valiz/filtre değiştiğinde `refreshSearchShopsAction` çağrılırken hiçbir
   * görsel geri bildirim yoktu — liste sessizce aynı kalıyor, sonuç gelince aniden
   * değişiyordu. Yavaş bağlantıda "değişikliğim işlendi mi?" belirsizliği yaratıyordu.
   */
  const [isSearching, setIsSearching] = useState(false);
  /**
   * Mobilde (bottom sheet) tarih/valiz/arama/sırala/filtre için hiçbir erişim
   * yoktu — yalnızca "Yakındaki/Tüm Noktalar" sekmeleri vardı. Bu, masaüstü
   * kenar panelindeki AYNI kontrolleri (searchAndDateControls,
   * sortAndAmenityControls) ayrı bir modal sheet'te açan tek bir durum.
   */
  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false);
  const isDesktop = useMediaQuery("(min-width: 768px)");
  /**
   * Yaris kosulu koruyucusu: iki filtre degisikligi ust uste hizli yapilirsa
   * iki ayri `refreshSearchShopsAction` cagrisi es zamanli ucabilir. Ag
   * gecikmesi degiskense ONCEKI (artik gecersiz) istek SONRAKINDEN GEC
   * donebilir ve onun sonucu son filtreyi ezerdi -- misafir bags=3 secmisken
   * ekran bags=2 sonuclarini gosterirdi. Her cagriya artan bir sira numarasi
   * verilip yalnizca EN GUNCEL istegin sonucu uygulanir.
   */
  const searchRequestSeq = useRef(0);
  useEffect(() => {
    setCheckInLocal(toDatetimeLocalValueInTimeZone(new Date(defaultCheckInIso)));
    setCheckOutLocal(toDatetimeLocalValueInTimeZone(new Date(defaultCheckOutIso)));
    setDatesReady(true);
  }, [defaultCheckInIso, defaultCheckOutIso]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const mq = window.matchMedia("(max-width: 767px)");
    if (mq.matches) setPanelOpen(true);
  }, []);

  useEffect(() => {
    setSearchQuery(initialSearchQuery);
  }, [initialSearchQuery]);

  useEffect(() => {
    if (!datesReady || !filterDirty) return;

    const checkIn = parseDatetimeLocalInTimeZone(checkInLocal);
    const checkOut = parseDatetimeLocalInTimeZone(checkOutLocal);
    if (!checkIn || !checkOut) return;

    const handle = window.setTimeout(async () => {
      const mySeq = ++searchRequestSeq.current;
      setIsSearching(true);
      try {
        const res = await refreshSearchShopsAction({
          checkInIso: checkIn.toISOString(),
          checkOutIso: checkOut.toISOString(),
          requestedBags,
          centerLat: dynamicCenter.lat,
          centerLng: dynamicCenter.lng,
        });
        // Bu sirada baska bir filtre degisikligi daha yeni bir istek baslattiysa
        // bu artik BAYAT bir yanittir -- uygulanmaz.
        if (mySeq !== searchRequestSeq.current) return;
        if (res.ok) {
          setNearbyList(res.nearby as ShopSearchHit[]);
          setAllList(res.all as ShopSearchHit[]);
          trackPlausibleEvent(PLAUSIBLE_EVENTS.SearchSubmitted, {
            nearbyCount: (res.nearby as ShopSearchHit[]).length,
            allCount: (res.all as ShopSearchHit[]).length,
            bags: requestedBags,
          });
        } else if (res.error?.startsWith("Errors.")) {
          toast.error(tErr(res.error.slice(7) as never));
        } else {
          toast.error(t("searchRefreshError"));
        }
      } finally {
        if (mySeq === searchRequestSeq.current) setIsSearching(false);
      }
    }, 400);

    return () => window.clearTimeout(handle);
  }, [
    datesReady,
    filterDirty,
    checkInLocal,
    checkOutLocal,
    requestedBags,
    tErr,
    t,
    dynamicCenter.lat,
    dynamicCenter.lng,
  ]);

  const handleManualRefresh = useCallback(async () => {
    const checkIn = parseDatetimeLocalInTimeZone(checkInLocal);
    const checkOut = parseDatetimeLocalInTimeZone(checkOutLocal);
    if (!checkIn || !checkOut) return;
    // Ayni sira sayaci: asagi cekip yenileme tam bir filtre degisikligiyle
    // cakisirsa hangisinin sonucu daha yeni ise o kazanir.
    const mySeq = ++searchRequestSeq.current;
    const res = await refreshSearchShopsAction({
      checkInIso: checkIn.toISOString(),
      checkOutIso: checkOut.toISOString(),
      requestedBags,
      centerLat: dynamicCenter.lat,
      centerLng: dynamicCenter.lng,
    });
    if (mySeq !== searchRequestSeq.current) return;
    if (res.ok) {
      setNearbyList(res.nearby as ShopSearchHit[]);
      setAllList(res.all as ShopSearchHit[]);
    }
  }, [checkInLocal, checkOutLocal, requestedBags, dynamicCenter.lat, dynamicCenter.lng]);

  const listRef = useRef<HTMLDivElement>(null);
  const { pullDistance, isRefreshing } = usePullToRefresh({ onRefresh: handleManualRefresh, containerRef: listRef });

  useEffect(() => {
    const normalize = (v: string) =>
      v
        .toLocaleLowerCase("tr")
        .normalize("NFD")
        .replace(/\p{Diacritic}/gu, "")
        .trim();
    const q = normalize(searchQuery);
    if (q.length < 3) {
      setResolvedPlaceLabel(null);
      return;
    }
    let cancelled = false;
    const timer = window.setTimeout(async () => {
      const geocoded = await geocodeSearchCenterAction(searchQuery, locale);
      if (cancelled) return;

      if (geocoded.ok) {
        setDynamicCenter((prev) => {
          if (prev.lat === geocoded.lat && prev.lng === geocoded.lng) return prev;
          setFilterDirty(true);
          return { lat: geocoded.lat, lng: geocoded.lng };
        });
        setResolvedPlaceLabel(geocoded.label);
        return;
      }

      // Fallback: known city centers if geocoding fails/rate-limits.
      const matchedCity = STORAGE_CITIES.find((city) => {
        const slug = normalize(city.slug.replace(/-/g, " "));
        return q === slug || q.includes(slug);
      });
      if (!matchedCity) return;
      setDynamicCenter((prev) => {
        if (prev.lat === matchedCity.lat && prev.lng === matchedCity.lng) return prev;
        setFilterDirty(true);
        return { lat: matchedCity.lat, lng: matchedCity.lng };
      });
      setResolvedPlaceLabel(matchedCity.slug);
    }, 450);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [searchQuery, locale]);

  const onSelectShop = useCallback(
    (id: string) => {
      try {
        sessionStorage.setItem("bagajpark_search_params", JSON.stringify({
          checkIn: checkInLocal,
          checkOut: checkOutLocal,
          bags: requestedBags,
        }));
      } catch {}
      router.push(`/shop/${id}`);
    },
    [router, checkInLocal, checkOutLocal, requestedBags]
  );

  const sourceShops = activeTab === "nearby" ? nearbyList : allList;

  const filteredShops = useMemo(() => {
    return sourceShops.filter((shop) => {
      const matchText =
        shop.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (shop.address &&
          shop.address.toLowerCase().includes(searchQuery.toLowerCase()));
      const r = shop.rating ?? 0;
      const p = shop.pricePerDay ?? 50;
      const open = open247Only ? shop.open247 === true : true;
      const wc = hasRestroom ? shop.hasRestroom === true : true;
      const amenities = shop as unknown as { hasCctv?: boolean; hasClimateControl?: boolean; acceptsLargeItems?: boolean };
      const cctv = hasCctv ? amenities.hasCctv === true : true;
      const climate = hasClimateControlFilter ? amenities.hasClimateControl === true : true;
      const large = acceptsLargeItemsFilter ? amenities.acceptsLargeItems === true : true;
      return matchText && r >= minRating && p <= maxPrice && open && wc && cctv && climate && large;
    });
  }, [searchQuery, sourceShops, minRating, maxPrice, open247Only, hasRestroom, hasCctv, hasClimateControlFilter, acceptsLargeItemsFilter]);

  const markFiltersDirty = () => setFilterDirty(true);

  const handleUseMyLocation = () => {
    if (!navigator.geolocation) {
      toast.error(t("searchGeolocationUnavailable"));
      return;
    }
    setGpsLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setDynamicCenter({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        setFilterDirty(true);
        setGpsLocating(false);
        toast.success(t("searchLocationUpdated"));
      },
      () => {
        setGpsLocating(false);
        toast.error(t("searchGeolocationDenied"));
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  const sortedShops = useMemo(() => {
    const list = [...filteredShops];
    switch (sortBy) {
      case "price_asc":
        list.sort((a, b) => (a.pricePerHour ?? a.pricePerDay ?? 0) - (b.pricePerHour ?? b.pricePerDay ?? 0));
        break;
      case "price_desc":
        list.sort((a, b) => (b.pricePerHour ?? b.pricePerDay ?? 0) - (a.pricePerHour ?? a.pricePerDay ?? 0));
        break;
      case "hourly":
        list.sort((a, b) => (a.pricePerHour ?? 0) - (b.pricePerHour ?? 0));
        break;
      case "rating":
        list.sort((a, b) => (b.rating ?? 0) - (a.rating ?? 0));
        break;
      case "distance":
      default:
        list.sort((a, b) => (a.distanceKm ?? 9999) - (b.distanceKm ?? 9999));
        break;
    }
    return list;
  }, [filteredShops, sortBy]);

  /**
   * Sonuç listesi TEK yerde tanımlanır, iki yerleşimden yalnızca birinde render edilir.
   *
   * 2026-08-23'e kadar mobil alt panelde yalnızca sekme başlıkları vardı — telefonda
   * dükkan LİSTESİ hiç yoktu, kullanıcı haritadaki pime basmak zorundaydı. Masaüstü
   * paneli ise `hidden md:flex` ile DOM'da duruyordu (çift başlık, çift veri).
   */
  const resultsList = (
  <div ref={listRef} className="flex-1 overflow-y-auto p-4 flex flex-col gap-4 bg-gray-50/50">
      {pullDistance > 0 && (
        <div className="flex justify-center py-2" style={{ transform: `translateY(${pullDistance}px)`, opacity: Math.min(1, pullDistance / 60) }}>
          {isRefreshing ? (
            <div className="w-6 h-6 border-2 border-gray-300 border-t-orange-600 rounded-full animate-spin" />
          ) : (
            <ArrowUpDown size={20} className="text-orange-600 animate-bounce" />
          )}
        </div>
      )}
      <div className="flex justify-between items-center px-1 mb-2">
        <h2
          data-testid="nearby-heading"
          className="flex items-center gap-2 text-sm id-eyebrow text-gray-900"
        >
          {activeTab === "nearby" ? t("nearbyShops") : t("allShops")} (
          {sortedShops.length})
          {isSearching && (
            <span
              className="h-3.5 w-3.5 shrink-0 animate-spin rounded-full border-2 border-gray-200 border-t-orange-600"
              role="status"
              aria-label={t("searchUpdating")}
            />
          )}
        </h2>
      </div>

      {sortedShops.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12 text-center gap-3">
          <MapPin size={40} className="text-gray-300" />
          <p className="text-sm font-bold text-gray-500">{t("noShopsFound")}</p>
          <p className="text-xs text-gray-400 max-w-[200px]">
            {t("noShopsFoundDesc")}
          </p>
          {activeTab === "nearby" && allList.length > 0 && (
            <button
              type="button"
              onClick={() => setActiveTab("all")}
              className="btn-ui btn-ui-sm btn-ui-secondary mt-2"
            >
              {t("allShops")} →
            </button>
          )}
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          <AnimatePresence mode="popLayout">
            {sortedShops.map((shop, index) => (
              <motion.div
                key={shop.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95 }}
                transition={{ delay: index * 0.05 }}
              >
                <ShopListItem
                  id={shop.id}
                  name={shop.name}
                  rating={shop.rating || 0}
                  price={Number(shop.pricePerDay) || 50}
                  distance={
                    shop.distanceKm != null
                      ? Math.round(shop.distanceKm * 1000).toString()
                      : "—"
                  }
                  lat={shop.latitude ?? undefined}
                  lng={shop.longitude ?? undefined}
                  bagsAvailable={shop.bagsAvailable}
                  isVerified={shop.isVerified}
                  responseTimeMinutes={shop.responseTimeMinutes}
                  slotPrices={(shop as unknown as { slotPrices?: { s: number; m: number; xl: number } }).slotPrices}
                  isPrelaunch={shop.isPrelaunch}
                  onClick={() => onSelectShop(shop.id)}
                />
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      )}
    </div>
  );

  const searchAndDateControls = (
    <>
      {resolvedPlaceLabel ? (
        <p className="mb-2 text-xs font-semibold text-gray-500 truncate">
          {resolvedPlaceLabel}
        </p>
      ) : null}

      <div className="flex gap-2 mb-3">
        <div className="relative group flex-1">
          <div className="absolute inset-y-0 left-4 flex items-center pointer-events-none">
            <SearchIcon
              size={18}
              className="text-gray-400 group-focus-within:text-orange-600 transition-colors"
            />
          </div>
          <input
            type="text"
            aria-label={t("searchPlaceholder")}
            placeholder={t("searchPlaceholder")}
            className="w-full pl-12 pr-4 py-3.5 bg-gray-50 border border-transparent focus:border-orange-500/30 focus:bg-white focus:ring-4 focus:ring-orange-500/5 rounded-2xl text-base font-semibold placeholder:text-gray-400 transition-all shadow-sm outline-none"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
        <button
          type="button"
          onClick={handleUseMyLocation}
          disabled={gpsLocating}
          className="shrink-0 h-[52px] w-[52px] bg-gray-50 hover:bg-orange-50 border border-transparent hover:border-orange-200 rounded-2xl flex items-center justify-center text-gray-400 hover:text-orange-600 transition-all disabled:opacity-50"
          title={t("useMyLocation")}
          aria-label={t("useMyLocation")}
        >
          {gpsLocating ? (
            <div className="w-5 h-5 border-2 border-gray-300 border-t-orange-600 rounded-full animate-spin" />
          ) : (
            <Crosshair size={20} />
          )}
        </button>
      </div>

      {datesReady ? (
        <section
          className="mb-3 space-y-2 rounded-2xl border border-gray-100 bg-gray-50/80 p-3"
          data-testid="search-stay-filters"
        >
          <p className="text-xs id-eyebrow text-gray-400">
            {t("searchStayWindow")}
          </p>
          <p className="text-[11px] text-gray-400">
            {t("searchOnlyAvailableHint")}
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <label className="flex flex-col gap-1">
              <span className="text-xs font-bold text-gray-400 uppercase">
                {t("searchCheckIn")}
              </span>
              <div className="rounded-xl bg-white border border-gray-100 px-2 py-2">
                <DateTimePicker
                  value={checkInLocal}
                  onChange={(v) => {
                    setCheckInLocal(v);
                    markFiltersDirty();
                  }}
                  testId="search-checkin"
                  ariaLabel={t("searchCheckIn")}
                  iconSize={14}
                />
              </div>
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-xs font-bold text-gray-400 uppercase">
                {t("searchCheckOut")}
              </span>
              <div className="rounded-xl bg-white border border-gray-100 px-2 py-2">
                <DateTimePicker
                  value={checkOutLocal}
                  onChange={(v) => {
                    setCheckOutLocal(v);
                    markFiltersDirty();
                  }}
                  testId="search-checkout"
                  ariaLabel={t("searchCheckOut")}
                  iconSize={14}
                  minDate={parseDatetimeLocalInTimeZone(checkInLocal) ?? undefined}
                />
              </div>
            </label>
          </div>
          <div className="flex items-center justify-between gap-3 pt-1">
            <span className="text-xs font-bold text-gray-400 uppercase">
              {t("searchBagCount")}
            </span>
            <div className="flex items-center gap-3">
              <button
                type="button"
                data-testid="search-bags-decrease"
                aria-label={tCommon("decrease", { label: t("searchBagCount") })}
                onClick={() => {
                  setRequestedBags((n) => Math.max(1, n - 1));
                  markFiltersDirty();
                }}
                disabled={requestedBags <= 1}
                className="w-9 h-9 rounded-full bg-white border border-gray-200 flex items-center justify-center disabled:opacity-30"
              >
                <Minus size={16} />
              </button>
              <span
                data-testid="search-bags-value"
                className="w-6 text-center font-black text-gray-900"
              >
                {requestedBags}
              </span>
              <button
                type="button"
                data-testid="search-bags-increase"
                aria-label={tCommon("increase", { label: t("searchBagCount") })}
                onClick={() => {
                  setRequestedBags((n) => Math.min(MAX_SEARCH_BAGS, n + 1));
                  markFiltersDirty();
                }}
                disabled={requestedBags >= MAX_SEARCH_BAGS}
                className="w-9 h-9 rounded-full bg-orange-600 text-white flex items-center justify-center disabled:opacity-40"
              >
                <Plus size={16} />
              </button>
            </div>
          </div>
        </section>
      ) : null}
    </>
  );

  const sortAndAmenityControls = (
    <>
      <div className="flex items-center gap-2 mb-2">
        <ArrowUpDown size={14} className="text-gray-400 shrink-0" />
        <select
          value={sortBy}
          onChange={(e) => setSortBy(e.target.value)}
          className="id-eyebrow bg-gray-50 border border-gray-200 rounded-lg px-2 py-1.5 text-gray-700 outline-none focus:border-orange-300"
          aria-label={t("sortBy")}
        >
          <option value="distance">{t("sortByDistance")}</option>
          <option value="price_asc">{t("sortByPriceLow")}</option>
          <option value="price_desc">{t("sortByPriceHigh")}</option>
          <option value="hourly">{t("sortByHourly")}</option>
          <option value="rating">{t("sortByRating")}</option>
        </select>
      </div>
      <div className="flex flex-wrap gap-2 id-eyebrow">
        <label className="flex items-center gap-1 bg-gray-50 px-2 py-1 rounded-lg">
          {t("filterMinRating")}
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
          {t("filterMaxPrice")}
          <input
            type="number"
            min={0}
            className="w-14 bg-transparent border-none text-xs font-black"
            value={maxPrice}
            onChange={(e) => setMaxPrice(Number(e.target.value) || 500)}
          />
        </label>
        <label className="flex items-center gap-1 cursor-pointer">
          <input
            type="checkbox"
            checked={open247Only}
            onChange={(e) => setOpen247Only(e.target.checked)}
          />
          7/24
        </label>
        <label className="flex items-center gap-1 cursor-pointer">
          <input
            type="checkbox"
            checked={hasRestroom}
            onChange={(e) => setHasRestroom(e.target.checked)}
          />
          WC
        </label>
        <label className="flex items-center gap-1 cursor-pointer">
          <input
            type="checkbox"
            checked={hasCctv}
            onChange={(e) => setHasCctv(e.target.checked)}
          />
          {t("filterCctv")}
        </label>
        <label className="flex items-center gap-1 cursor-pointer">
          <input
            type="checkbox"
            checked={hasClimateControlFilter}
            onChange={(e) => setHasClimateControlFilter(e.target.checked)}
          />
          {t("filterClimate")}
        </label>
        <label className="flex items-center gap-1 cursor-pointer">
          <input
            type="checkbox"
            checked={acceptsLargeItemsFilter}
            onChange={(e) => setAcceptsLargeItemsFilter(e.target.checked)}
          />
          {t("filterLargeItems")}
        </label>
      </div>
    </>
  );

  const activeAmenityFilterCount = [
    minRating > 0,
    maxPrice < 500,
    open247Only,
    hasRestroom,
    hasCctv,
    hasClimateControlFilter,
    acceptsLargeItemsFilter,
  ].filter(Boolean).length;

  return (
    <div className="relative h-[100svh] w-full overflow-hidden bg-white font-sans selection:bg-orange-100">
      <div className="absolute inset-0 z-0">
        <SearchMap
          shops={filteredShops}
          userLat={dynamicCenter.lat}
          userLng={dynamicCenter.lng}
          onSelectShop={onSelectShop}
        />
      </div>

      {!panelOpen ? (
        <button
          type="button"
          onClick={() => setPanelOpen(true)}
          aria-label={t("openSearchPanel")}
          className="md:hidden absolute top-4 left-4 z-20 h-12 px-5 rounded-full bg-white shadow-lg border border-gray-100 flex items-center gap-2 id-eyebrow text-xs text-gray-900 hover:bg-gray-50 active:scale-95 transition-all"
        >
          <SlidersHorizontal size={16} className="text-orange-600" />
          {filteredShops.length}
        </button>
      ) : null}

      {/* Desktop: sidebar panel */}
      {isDesktop && (
      <aside
        className={`hidden md:flex absolute left-0 top-0 z-10 h-full w-[420px] max-w-full bg-white/95 backdrop-blur-xl shadow-2xl shadow-[8px_0_24px_-12px_rgba(0,0,0,0.25)] flex-col border-r border-gray-100`}
      >
      <header className="px-4 pt-4 pb-3 border-b border-gray-100 bg-white/80 backdrop-blur-xl z-20 shrink-0">
        <div className="flex items-center gap-3 mb-3">
          <Link
            href="/"
            className="btn-ui btn-ui-md btn-ui-ghost btn-ui-icon rounded-full"
          >
            <ChevronLeft size={22} className="text-gray-900" />
          </Link>
          <div className="flex-1">
            <h1 className="text-xs font-black text-gray-400 uppercase tracking-[0.2em]">
              {t("searchPlaceholder")}
            </h1>
          </div>
        </div>

        {searchAndDateControls}

        <button
          type="button"
          onClick={() => setFiltersOpen((v) => !v)}
          className="flex items-center gap-2 id-eyebrow text-gray-400 hover:text-gray-700 py-1"
        >
          <SlidersHorizontal size={12} />
          {filtersOpen ? t("hideFilters") : t("showFilters")} ({sortedShops.length})
        </button>

        <div className="flex items-center gap-3 mb-3">
          <div className="flex bg-gray-100 rounded-xl p-1 flex-1">
            <button
              type="button"
              onClick={() => setActiveTab("nearby")}
              className={`flex-1 py-2 px-3 rounded-lg text-xs font-black uppercase tracking-wider transition-all ${
                activeTab === "nearby"
                  ? "bg-white text-orange-600 shadow-sm"
                  : "text-gray-500 hover:text-gray-700"
              }`}
            >
              {t("nearbyShops")} ({nearbyList.length})
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("all")}
              className={`flex-1 py-2 px-3 rounded-lg text-xs font-black uppercase tracking-wider transition-all ${
                activeTab === "all"
                  ? "bg-white text-orange-600 shadow-sm"
                  : "text-gray-500 hover:text-gray-700"
              }`}
            >
              {t("allShops")} ({allList.length})
            </button>
          </div>
        </div>

        {filtersOpen && sortAndAmenityControls}
      </header>

      {resultsList}
      </aside>
      )}

      {/* Mobile: bottom sheet — sekmeler + liste; yukarı çekilince liste büyür */}
      {!isDesktop && (
      <div className="md:hidden">
        <BottomSheet
          open={panelOpen}
          onClose={() => setPanelOpen(false)}
          snapPoints={[22, 60, 92]}
          initialSnap={0}
          showClose={false}
          showOverlay={false}
          ariaLabel={t("allShops")}
          aboveMobileNav
        >
          <header className="px-4 pt-2 pb-3 border-b border-gray-100 shrink-0">
            <div className="flex items-center gap-2">
              <div className="flex bg-gray-100 rounded-xl p-1 flex-1">
                <button
                  type="button"
                  onClick={() => setActiveTab("nearby")}
                  className={`flex-1 py-2 px-3 rounded-lg text-xs font-black uppercase tracking-wider transition-all ${activeTab === "nearby" ? "bg-white text-orange-600 shadow-sm" : "text-gray-500 hover:text-gray-700"}`}
                >
                  {t("nearbyShops")} ({nearbyList.length})
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab("all")}
                  className={`flex-1 py-2 px-3 rounded-lg text-xs font-black uppercase tracking-wider transition-all ${activeTab === "all" ? "bg-white text-orange-600 shadow-sm" : "text-gray-500 hover:text-gray-700"}`}
                >
                  {t("allShops")} ({allList.length})
                </button>
              </div>
              <button
                type="button"
                onClick={() => setMobileFiltersOpen(true)}
                aria-label={t("showFilters")}
                className="relative shrink-0 flex h-[38px] w-[38px] items-center justify-center rounded-xl bg-gray-100 text-gray-600 active:scale-95 transition-all"
              >
                <SlidersHorizontal size={16} />
                {activeAmenityFilterCount > 0 && (
                  <span className="absolute -right-1 -top-1 flex h-4 w-4 items-center justify-center rounded-full bg-orange-600 text-[9px] font-black text-white">
                    {activeAmenityFilterCount}
                  </span>
                )}
              </button>
            </div>
          </header>
          {resultsList}
        </BottomSheet>

        {/* Mobil: tarih/valiz/arama/sırala/filtre — masaüstündeki AYNI kontroller,
            ayrı bir modal sheet'te (bkz. searchAndDateControls/sortAndAmenityControls). */}
        <BottomSheet
          open={mobileFiltersOpen}
          onClose={() => setMobileFiltersOpen(false)}
          title={t("showFilters")}
          snapPoints={[92]}
          initialSnap={0}
          showClose
          showOverlay
        >
          <div className="flex-1 overflow-y-auto p-4">
            {searchAndDateControls}
            {sortAndAmenityControls}
          </div>
          <div className="shrink-0 border-t border-gray-100 p-4">
            <button
              type="button"
              onClick={() => setMobileFiltersOpen(false)}
              className="btn-ui btn-ui-md btn-ui-primary w-full"
            >
              {t("showResults", { count: sortedShops.length })}
            </button>
          </div>
        </BottomSheet>
      </div>
      )}
    </div>
  );
}
