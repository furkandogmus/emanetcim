"use client";

import { useEffect, useRef, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { formatTryCurrency } from "@/lib/currency";
import { getMapStyle, MAP_ATTRIBUTION } from "@/lib/map-style";

type Shop = {
  id: string;
  name: string;
  latitude: number | null;
  longitude: number | null;
  pricePerDay?: number;
  /** Talep testi noktası: pin'de fiyat değil "Yakında" yazar. */
  isPrelaunch?: boolean;
};

interface SearchMapProps {
  shops: Shop[];
  userLat?: number;
  userLng?: number;
  onSelectShop?: (id: string) => void;
}

/**
 * OSM tabanlı harita (MapLibre). API anahtarı gerektirmez.
 */
export default function SearchMap({
  shops,
  userLat = 41.0256,
  userLng = 28.9741,
  onSelectShop,
}: SearchMapProps) {
  const locale = useLocale();
  const t = useTranslations("Guest");
  const tCommon = useTranslations("Common");
  /**
   * Altlık boyanana kadar iskelet gösterilir.
   *
   * NEDEN: altlık vektör (OpenFreeMap) ve ilk boyama soğuk açılışta birkaç
   * saniye sürüyor — MapLibre önce stili, sonra fontları, sprite'ı ve karoları
   * çekiyor. O sürede ekranda BEMBEYAZ bir alan duruyordu; üstünde turuncu
   * pinler yüzüyor ama zemin yok. Kullanıcı bunu "yavaş" diye değil "bozuk"
   * diye okuyor — hatta bu oturumda tam olarak öyle okundu. Boş beyazlık bir
   * durum bildirmiyor; iskelet bildiriyor.
   */
  const [mapReady, setMapReady] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const markersRef = useRef<maplibregl.Marker[]>([]);
  const selectRef = useRef(onSelectShop);

  useEffect(() => {
    selectRef.current = onSelectShop;
  }, [onSelectShop]);

  const initialCenter = useRef<[number, number]>([userLng, userLat]);

  // Haritayı bir kez oluştur
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    const map = new maplibregl.Map({
      container: containerRef.current,
      style: getMapStyle(),
      center: initialCenter.current,
      zoom: 15,
      // Atıf sağlayıcının TileJSON'ına bırakılmaz: o zincir koptuğunda atıf da
      // sessizce kayboluyor (bkz. `MAP_ATTRIBUTION`).
      attributionControl: { compact: true, customAttribution: MAP_ATTRIBUTION },
    });

    map.addControl(new maplibregl.NavigationControl(), "top-right");
    mapRef.current = map;

    map.on("load", () => setMapReady(true));

    /*
      GUVENLIK SUPABI: altlik hic gelmezse (karo sunucusuna erisilemiyor, ag
      kesik) `load` HIC tetiklenmez ve iskelet sonsuza kadar donerdi -- yani
      "yavas" hissi, "hicbir sey olmuyor" hissine donusurdu. Sure dolunca
      iskelet kaldirilir: kullanici en azindan pinleri ve kontrolleri gorur,
      haritayi kaydirabilir.
    */
    const failSafe = window.setTimeout(() => setMapReady(true), 10_000);

    // container boyutu değişirse haritayı güncelle
    const resizeObserver = new ResizeObserver(() => map.resize());
    resizeObserver.observe(containerRef.current);

    return () => {
      window.clearTimeout(failSafe);
      resizeObserver.disconnect();
      map.remove();
      mapRef.current = null;
    };
  }, []); // Artık lint hatası vermez

  // Dışarıdan gelen merkez değiştiğinde haritayı hedefe taşı.
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const current = map.getCenter();
    const epsilon = 0.0001;
    if (
      Math.abs(current.lat - userLat) < epsilon &&
      Math.abs(current.lng - userLng) < epsilon
    ) {
      return;
    }
    map.flyTo({
      center: [userLng, userLat],
      zoom: Math.max(map.getZoom(), 12),
      duration: 700,
      essential: true,
    });
  }, [userLat, userLng]);

  // Shop'lar değiştikçe marker'ları güncelle
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    // Eskileri temizle
    markersRef.current.forEach(m => m.remove());
    markersRef.current = [];

    const valid = shops.filter((s) => s.latitude != null && s.longitude != null);

    valid.forEach((shop) => {
      const el = document.createElement("div");
      el.className =
        "px-2.5 h-8 min-w-8 rounded-full bg-orange-600 border-2 border-white shadow-lg flex items-center justify-center text-xs font-black text-white cursor-pointer hover:bg-orange-700 transition-colors whitespace-nowrap focus:outline-none focus-visible:ring-2 focus-visible:ring-gray-900 focus-visible:ring-offset-2";
      /*
        Talep testi noktasında pin'e fiyat yazılmaz: oradaki `pricePerDay` şema
        varsayılanıdır (₺50), esnafla anlaşılmadığı için gerçek bir fiyat değil
        ve nokta yurt dışındaysa yanlış para biriminde. Kart ve detay sayfası da
        aynı yerde "Yakında" gösteriyor — haritanın ayrışmaması gerekiyor.
      */
      el.textContent = shop.isPrelaunch
        ? t("prelaunchBadge")
        : shop.pricePerDay != null
          ? formatTryCurrency(shop.pricePerDay, locale, {
              minimumFractionDigits: 0,
              maximumFractionDigits: 0,
            })
          : "₺";
      el.title = shop.name;
      // Marker'lar MapLibre tarafından ham DOM element'i olarak eklendiği için
      // yalnızca fare/dokunmatikle çalışıyordu — klavye kullanıcısı hiçbir
      // dükkanı seçemiyordu. `role="button"` + `tabIndex` + Enter/Space,
      // <button>'ın klavye davranışını taklit eder.
      el.setAttribute("role", "button");
      el.tabIndex = 0;
      el.setAttribute("aria-label", shop.name);

      const marker = new maplibregl.Marker({ element: el })
        .setLngLat([shop.longitude!, shop.latitude!])
        .addTo(map);

      const select = () => selectRef.current?.(shop.id);
      el.addEventListener("click", select);
      el.addEventListener("keydown", (e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          select();
        }
      });
      markersRef.current.push(marker);
    });

    if (valid.length > 0) {
      const b = new maplibregl.LngLatBounds(
        [valid[0].longitude!, valid[0].latitude!],
        [valid[0].longitude!, valid[0].latitude!]
      );
      valid.forEach((s) => b.extend([s.longitude!, s.latitude!]));
      map.fitBounds(b, { padding: 80, maxZoom: 15, duration: 800 });
    } else {
      // Sonuç yoksa yine de kullanıcının aradığı merkeze dön.
      map.flyTo({
        center: [userLng, userLat],
        zoom: 12,
        duration: 700,
        essential: true,
      });
    }
  }, [shops, userLat, userLng, locale, t]);

  return (
    <div className="absolute inset-0 w-full h-full min-h-[240px]">
      <div ref={containerRef} className="absolute inset-0 w-full h-full" />
      {mapReady ? null : (
        <div
          role="status"
          aria-live="polite"
          className="absolute inset-0 flex items-center justify-center bg-gray-100"
        >
          {/* Zeminin kendisi de bir sinyal: hareket eden bir yuzey, donmus bir
              ekran olmadigini soyluyor. */}
          <div className="absolute inset-0 animate-pulse bg-gradient-to-br from-gray-100 via-gray-50 to-gray-100" />
          <span className="relative id-eyebrow text-gray-400">
            {tCommon("loading")}
          </span>
        </div>
      )}
    </div>
  );
}
