"use client";

import { useEffect, useRef, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { formatTryCurrency } from "@/lib/currency";
import { getMapStyle, MAP_ATTRIBUTION } from "@/lib/map-style";

/**
 * İki pin'in çakışmadan durabildiği en küçük ekran mesafesi (px).
 *
 * Pin 32 px yüksekliğinde ve genişliği metne göre büyüyor ("Yakında" ~72 px).
 * 44 px, WCAG dokunma hedefi eşiğiyle de aynı: bu mesafenin altındaki iki pin
 * ne okunabiliyor ne de ayrı ayrı dokunulabiliyor.
 */
const MIN_PIN_DISTANCE_PX = 44;

export type ClusterInput = { id: string; x: number; y: number };

/**
 * Ekranda üst üste binen noktaları TEK pin'de toplar.
 *
 * NEDEN EKRAN PİKSELİ, coğrafi mesafe değil: çakışma bir GÖRÜNTÜ olayı.
 * Aynı iki nokta z=10'da üst üste binerken z=16'da rahatça ayrı durur;
 * coğrafi bir eşik ise yakınlaştırmadan bağımsız olur ve ya erken kümeler ya
 * da hiç kümelemez.
 *
 * Açgözlü ve SIRAYA BAĞLI: liste zaten mesafeye/puana göre sıralı geliyor, yani
 * kümenin temsilcisi en alakalı nokta oluyor. Kararlı olması da önemli —
 * her `moveend`'de yeniden hesaplanıyor ve pin'lerin zıplaması istenmiyor.
 */
export function clusterByScreenDistance(
  points: ClusterInput[],
  minDistancePx = MIN_PIN_DISTANCE_PX,
): ClusterInput[][] {
  const groups: ClusterInput[][] = [];
  const taken = new Set<string>();

  for (const p of points) {
    if (taken.has(p.id)) continue;
    taken.add(p.id);
    const group = [p];
    for (const q of points) {
      if (taken.has(q.id)) continue;
      const dx = p.x - q.x;
      const dy = p.y - q.y;
      if (Math.hypot(dx, dy) < minDistancePx) {
        taken.add(q.id);
        group.push(q);
      }
    }
    groups.push(group);
  }
  return groups;
}

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

  /*
    Harita bir KEZ kuruluyor (asagidaki etkinin bagimlilik dizisi bos), ama
    etiketler cevirilerden geliyor. `selectRef` ile ayni kalip: deger ref'te
    tutuluyor, boylece kurulum etkisi cevirilere bagimli olmuyor ve harita
    her dil degisiminde yeniden yaratilmiyor.

    Pratikte dil degisimi zaten rotayi degistirip bileseni yeniden monte eder;
    ref yalnizca kurulum anindaki dogru degeri garanti ediyor.
  */
  const mapLocaleRef = useRef<Record<string, string>>({});
  useEffect(() => {
    mapLocaleRef.current = {
      "NavigationControl.ZoomIn": tCommon("mapZoomIn"),
      "NavigationControl.ZoomOut": tCommon("mapZoomOut"),
      "NavigationControl.ResetBearing": tCommon("mapResetBearing"),
      "AttributionControl.ToggleAttribution": tCommon("mapToggleAttribution"),
    };
  }, [tCommon]);

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
      /*
        HARITA KONTROLLERININ DILI.

        Olculdu (2026-08-31): MapLibre kendi erisilebilirlik etiketlerini
        INGILIZCE basiyor, sayfanin diliyle ilgilenmiyor. Turkce arayuzde ekran
        okuyucu, urunun ANA ekraninda sunlari duyuyordu:

          dugme -> "Zoom in" / "Zoom out"
          ozet  -> "Toggle attribution"

        Ayni sinif hata takvimde de vardi (react-day-picker). Ucuncu taraf bir
        bilesen eklerken "kendi metinlerini de basiyor mu" diye bakmak
        gerekiyor: bu metinler yalnizca ekran okuyucuya gittigi icin gozle
        bakinca hic gorunmuyor.
      */
      locale: mapLocaleRef.current,
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

  /**
   * Pin'leri çiz — ÇAKIŞANLARI TEK PİN'DE TOPLAYARAK.
   *
   * NEDEN GEREKTİ: talep testi 50 noktadan 482'ye çıkınca İstanbul gibi yoğun
   * bir merkezde altı "Yakında" etiketi birbirinin üstüne biniyor ve hiçbiri
   * okunmuyordu (2026-08-31 mobil ölçümü). Tek tek çizmek, nokta sayısı
   * arttıkça haritayı okunmaz yapıyor.
   *
   * Kümeleme MapLibre'nin GeoJSON küme katmanıyla DEĞİL, ekran mesafesiyle
   * yapılıyor: küme katmanı pin'lerin fiyat/"Yakında" etiketini ve DOM
   * tıklama/klavye davranışını kaybettirirdi. Burada görünüm aynı kalıyor,
   * yalnızca üst üste binenler tek bir sayıya dönüşüyor.
   *
   * `moveend`'e abone: kümeleme yakınlaştırmaya bağlı, yani her hareketten
   * sonra yeniden hesaplanmalı. `fitBounds` de bir `moveend` üretir; bu
   * yeniden çizimi tetikler ama YENİDEN SIĞDIRMAZ (sığdırma ayrı efektte),
   * yoksa sonsuz döngü olurdu.
   */
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    const valid = shops.filter((s) => s.latitude != null && s.longitude != null);

    const draw = () => {
      markersRef.current.forEach((m) => m.remove());
      markersRef.current = [];

      const projected = valid.map((shop) => {
        const p = map.project([shop.longitude!, shop.latitude!]);
        return { id: shop.id, x: p.x, y: p.y };
      });
      const byId = new Map(valid.map((s) => [s.id, s]));

      for (const group of clusterByScreenDistance(projected)) {
        const head = byId.get(group[0].id)!;
        const el = document.createElement("div");
        el.className =
          "px-2.5 h-8 min-w-8 rounded-full bg-orange-600 border-2 border-white shadow-lg flex items-center justify-center text-xs font-black text-white cursor-pointer hover:bg-orange-700 transition-colors whitespace-nowrap focus:outline-none focus-visible:ring-2 focus-visible:ring-gray-900 focus-visible:ring-offset-2";

        if (group.length > 1) {
          const label = t("mapClusterLabel", { count: group.length });
          el.textContent = String(group.length);
          el.title = label;
          el.setAttribute("aria-label", label);
        } else {
          /*
            Talep testi noktasında pin'e fiyat yazılmaz: oradaki `pricePerDay`
            şema varsayılanıdır (₺50), esnafla anlaşılmadığı için gerçek bir
            fiyat değil ve nokta yurt dışındaysa yanlış para biriminde. Kart ve
            detay sayfası da aynı yerde "Yakında" gösteriyor.
          */
          el.textContent = head.isPrelaunch
            ? t("prelaunchBadge")
            : head.pricePerDay != null
              ? formatTryCurrency(head.pricePerDay, locale, {
                  minimumFractionDigits: 0,
                  maximumFractionDigits: 0,
                })
              : "₺";
          el.title = head.name;
          el.setAttribute("aria-label", head.name);
        }

        // Ham DOM ögesi olduğu için klavye davranışı elle taklit ediliyor.
        el.setAttribute("role", "button");
        el.tabIndex = 0;

        const activate = () => {
          if (group.length > 1) {
            /*
              Kümeye dokunmak SEÇMEZ, YAKINLAŞTIRIR: hangi noktanın kastedildiği
              belirsizken birini açmak kullanıcı adına karar vermek olurdu.
            */
            const b = new maplibregl.LngLatBounds();
            for (const g of group) {
              const s2 = byId.get(g.id)!;
              b.extend([s2.longitude!, s2.latitude!]);
            }
            map.fitBounds(b, { padding: 120, maxZoom: 17, duration: 600 });
            return;
          }
          selectRef.current?.(head.id);
        };

        const marker = new maplibregl.Marker({ element: el })
          .setLngLat([head.longitude!, head.latitude!])
          .addTo(map);

        el.addEventListener("click", activate);
        el.addEventListener("keydown", (e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            activate();
          }
        });
        markersRef.current.push(marker);
      }
    };

    draw();
    map.on("moveend", draw);
    return () => {
      map.off("moveend", draw);
    };
  }, [shops, locale, t]);

  /** Sonuçlara sığdırma — çizimden AYRI, yoksa `moveend` sonsuz döngü olur. */
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const valid = shops.filter((s) => s.latitude != null && s.longitude != null);

    if (valid.length > 0) {
      const b = new maplibregl.LngLatBounds(
        [valid[0].longitude!, valid[0].latitude!],
        [valid[0].longitude!, valid[0].latitude!],
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
  }, [shops, userLat, userLng]);

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
