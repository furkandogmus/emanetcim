"use client";

import { useEffect, useRef } from "react";
import maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";

type Shop = {
  id: string;
  name: string;
  latitude: number | null;
  longitude: number | null;
  pricePerDay?: number;
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
    const map = new maplibregl.Map({
      container: containerRef.current,
      style: {
        version: 8,
        sources: {
          "osm-tiles": {
            type: "raster",
            tiles: [
              "https://a.tile.openstreetmap.org/{z}/{x}/{y}.png",
              "https://b.tile.openstreetmap.org/{z}/{x}/{y}.png",
              "https://c.tile.openstreetmap.org/{z}/{x}/{y}.png",
            ],
            tileSize: 256,
            attribution: "&copy; <a href=\"https://www.openstreetmap.org/copyright\">OpenStreetMap</a> contributors",
          },
        },
        layers: [
          {
            id: "osm-tiles-layer",
            type: "raster",
            source: "osm-tiles",
            minzoom: 0,
            maxzoom: 19,
          },
        ],
      },
      center: initialCenter.current,
      zoom: 15,
    });

    map.addControl(new maplibregl.NavigationControl(), "top-right");
    mapRef.current = map;

    // container boyutu değişirse haritayı güncelle
    const resizeObserver = new ResizeObserver(() => map.resize());
    resizeObserver.observe(containerRef.current);

    return () => {
      resizeObserver.disconnect();
      map.remove();
      mapRef.current = null;
    };
  }, []); // Artık lint hatası vermez

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
        "w-8 h-8 rounded-full bg-orange-600 border-2 border-white shadow-lg flex items-center justify-center text-[10px] font-black text-white cursor-pointer hover:scale-110 hover:bg-orange-700 transition-all";
      el.textContent = "₺";
      el.title = shop.name;

      const marker = new maplibregl.Marker({ element: el })
        .setLngLat([shop.longitude!, shop.latitude!])
        .addTo(map);

      el.addEventListener("click", () => selectRef.current?.(shop.id));
      markersRef.current.push(marker);
    });

    if (valid.length > 0) {
      const b = new maplibregl.LngLatBounds(
        [valid[0].longitude!, valid[0].latitude!],
        [valid[0].longitude!, valid[0].latitude!]
      );
      valid.forEach((s) => b.extend([s.longitude!, s.latitude!]));
      map.fitBounds(b, { padding: 80, maxZoom: 15, duration: 800 });
    }
  }, [shops]);

  return <div ref={containerRef} className="absolute inset-0 w-full h-full min-h-[240px]" />;
}
