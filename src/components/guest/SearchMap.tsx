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
  const selectRef = useRef(onSelectShop);

  useEffect(() => {
    selectRef.current = onSelectShop;
  }, [onSelectShop]);

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    const map = new maplibregl.Map({
      container: containerRef.current,
      style: "https://basemaps.cartocdn.com/gl/positron-gl-style/style.json",
      center: [userLng, userLat],
      zoom: 13,
    });

    map.addControl(new maplibregl.NavigationControl(), "top-right");
    mapRef.current = map;

    const valid = shops.filter((s) => s.latitude != null && s.longitude != null);

    valid.forEach((shop) => {
      const el = document.createElement("div");
      el.className =
        "w-8 h-8 rounded-full bg-orange-600 border-2 border-white shadow-lg flex items-center justify-center text-[10px] font-black text-white cursor-pointer";
      el.textContent = "₺";
      el.title = shop.name;

      new maplibregl.Marker({ element: el })
        .setLngLat([shop.longitude!, shop.latitude!])
        .addTo(map);

      el.addEventListener("click", () => selectRef.current?.(shop.id));
    });

    if (valid.length > 0) {
      const b = new maplibregl.LngLatBounds(
        [valid[0].longitude!, valid[0].latitude!],
        [valid[0].longitude!, valid[0].latitude!]
      );
      valid.forEach((s) => b.extend([s.longitude!, s.latitude!]));
      map.fitBounds(b, { padding: 48, maxZoom: 15 });
    }

    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, [shops, userLat, userLng]);

  return <div ref={containerRef} className="absolute inset-0 w-full h-full min-h-[240px]" />;
}
