"use client";

import { useTranslations } from "next-intl";
import { useLocale } from "next-intl";
import { useState, useMemo, useCallback, useEffect } from "react";
import {
  Search as SearchIcon,
  ChevronLeft,
  MapPin,
  Calendar,
  Minus,
  Plus,
} from "lucide-react";
import { Link } from "@/i18n/routing";
import { useRouter } from "@/i18n/routing";
import ShopListItem from "@/components/guest/ShopListItem";
import SearchMap from "@/components/guest/SearchMap";
import { motion, AnimatePresence } from "framer-motion";
import type { ShopSearchHit } from "@/services/ShopService";
import { parseDatetimeLocal, toDatetimeLocalValue } from "@/lib/datetime-local";
import { refreshSearchShopsAction } from "@/actions/search-shops";
import { geocodeSearchCenterAction } from "@/actions/geocode-search-center";
import { toast } from "sonner";
import { STORAGE_CITIES } from "@/lib/storage-cities";
import {
  PLAUSIBLE_EVENTS,
  trackPlausibleEvent,
} from "@/lib/plausible-events";

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
  const tErr = useTranslations("Errors");
  const locale = useLocale();
  const router = useRouter();
  const [searchQuery, setSearchQuery] = useState(initialSearchQuery);
  const [minRating, setMinRating] = useState(0);
  const [maxPrice, setMaxPrice] = useState(500);
  const [open247Only, setOpen247Only] = useState(false);
  const [hasRestroom, setHasRestroom] = useState(false);
  const [activeTab, setActiveTab] = useState<Tab>("nearby");

  const [nearbyList, setNearbyList] = useState<ShopSearchHit[]>(initialNearby);
  const [allList, setAllList] = useState<ShopSearchHit[]>(initialAll);

  const [checkInLocal, setCheckInLocal] = useState("");
  const [checkOutLocal, setCheckOutLocal] = useState("");
  const [datesReady, setDatesReady] = useState(false);
  const [requestedBags, setRequestedBags] = useState(1);
  const [filterDirty, setFilterDirty] = useState(false);
  const [dynamicCenter, setDynamicCenter] = useState(searchCenter);
  const [resolvedPlaceLabel, setResolvedPlaceLabel] = useState<string | null>(null);

  useEffect(() => {
    setCheckInLocal(toDatetimeLocalValue(new Date(defaultCheckInIso)));
    setCheckOutLocal(toDatetimeLocalValue(new Date(defaultCheckOutIso)));
    setDatesReady(true);
  }, [defaultCheckInIso, defaultCheckOutIso]);

  useEffect(() => {
    setSearchQuery(initialSearchQuery);
  }, [initialSearchQuery]);

  useEffect(() => {
    if (!datesReady || !filterDirty) return;

    const checkIn = parseDatetimeLocal(checkInLocal);
    const checkOut = parseDatetimeLocal(checkOutLocal);
    if (!checkIn || !checkOut) return;

    const handle = window.setTimeout(async () => {
      const res = await refreshSearchShopsAction({
        checkInIso: checkIn.toISOString(),
        checkOutIso: checkOut.toISOString(),
        requestedBags,
        centerLat: dynamicCenter.lat,
        centerLng: dynamicCenter.lng,
      });
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
      router.push(`/shop/${id}`);
    },
    [router]
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
      return matchText && r >= minRating && p <= maxPrice && open && wc;
    });
  }, [searchQuery, sourceShops, minRating, maxPrice, open247Only, hasRestroom]);

  const markFiltersDirty = () => setFilterDirty(true);

  return (
    <div className="flex flex-col min-h-[100svh] bg-white font-sans selection:bg-orange-100">
      <header className="px-4 pt-4 pb-3 border-b border-gray-100 bg-white/80 backdrop-blur-xl z-20 sticky top-0 max-h-[52svh] overflow-y-auto md:max-h-none">
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
        {resolvedPlaceLabel ? (
          <p className="mb-2 text-xs font-semibold text-gray-500 truncate">
            {resolvedPlaceLabel}
          </p>
        ) : null}

        <div className="relative group mb-3">
          <div className="absolute inset-y-0 left-4 flex items-center pointer-events-none">
            <SearchIcon
              size={18}
              className="text-gray-400 group-focus-within:text-orange-600 transition-colors"
            />
          </div>
          <input
            type="text"
            placeholder={t("searchPlaceholder")}
            className="w-full pl-12 pr-4 py-3.5 bg-gray-50 border border-transparent focus:border-orange-500/30 focus:bg-white focus:ring-4 focus:ring-orange-500/5 rounded-2xl text-base font-semibold placeholder:text-gray-400 transition-all shadow-sm outline-none"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>

        {datesReady ? (
          <section
            className="mb-3 space-y-2 rounded-2xl border border-gray-100 bg-gray-50/80 p-3"
            data-testid="search-stay-filters"
          >
            <p className="text-xs font-black uppercase tracking-widest text-gray-400">
              {t("searchStayWindow")}
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <label className="flex flex-col gap-1">
                <span className="text-xs font-bold text-gray-400 uppercase">
                  {t("searchCheckIn")}
                </span>
                <div className="flex items-center gap-2 rounded-xl bg-white border border-gray-100 px-2 py-1.5">
                  <Calendar size={14} className="text-gray-400 shrink-0" />
                  <input
                    type="datetime-local"
                    data-testid="search-checkin"
                    value={checkInLocal}
                    onChange={(e) => {
                      setCheckInLocal(e.target.value);
                      markFiltersDirty();
                    }}
                    className="w-full text-xs font-semibold bg-transparent outline-none min-h-[40px]"
                  />
                </div>
              </label>
              <label className="flex flex-col gap-1">
                <span className="text-xs font-bold text-gray-400 uppercase">
                  {t("searchCheckOut")}
                </span>
                <div className="flex items-center gap-2 rounded-xl bg-white border border-gray-100 px-2 py-1.5">
                  <Calendar size={14} className="text-gray-400 shrink-0" />
                  <input
                    type="datetime-local"
                    data-testid="search-checkout"
                    value={checkOutLocal}
                    onChange={(e) => {
                      setCheckOutLocal(e.target.value);
                      markFiltersDirty();
                    }}
                    className="w-full text-xs font-semibold bg-transparent outline-none min-h-[40px]"
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
                  aria-label="Decrease bags"
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
                  aria-label="Increase bags"
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

        <div className="flex flex-wrap gap-2 text-[10px] font-bold uppercase tracking-widest">
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
        </div>
      </header>

      <main className="flex-1 flex flex-col md:flex-row overflow-hidden relative min-h-0">
        <div className="w-full md:w-1/3 lg:w-1/4 h-auto md:h-full overflow-y-auto p-4 flex flex-col gap-4 bg-gray-50/50 border-r border-gray-100 order-2 md:order-1 min-h-0">
          <div className="flex justify-between items-center px-1 mb-2">
            <h2
              data-testid="nearby-heading"
              className="text-sm font-black text-gray-900 uppercase tracking-widest"
            >
              {activeTab === "nearby" ? t("nearbyShops") : t("allShops")} (
              {filteredShops.length})
            </h2>
          </div>

          {filteredShops.length === 0 ? (
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
                      distance={
                        shop.distanceKm != null
                          ? Math.round(shop.distanceKm * 1000).toString()
                          : "—"
                      }
                      lat={shop.latitude ?? undefined}
                      lng={shop.longitude ?? undefined}
                      bagsAvailable={shop.bagsAvailable}
                      onClick={() => router.push(`/shop/${shop.id}`)}
                    />
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>
          )}
        </div>

        <div className="flex-1 h-[34svh] md:h-full bg-gray-100 relative order-1 md:order-2 overflow-hidden min-h-[220px]">
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
