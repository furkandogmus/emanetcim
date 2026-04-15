"use client";

import { useEffect, useRef, useState } from "react";
import { MapPin, Navigation, Loader2 } from "lucide-react";
import { getCityNames, getDistricts } from "@/lib/tr-cities";

interface LocationValue {
  address: string;
  city: string;
  district: string;
  latitude: number | null;
  longitude: number | null;
}

interface Props {
  value: LocationValue;
  onChange: (val: LocationValue) => void;
}

// Türkiye merkezi
const DEFAULT_CENTER = { lat: 39.0, lng: 35.0 };
const DEFAULT_ZOOM = 5.5;

export default function LocationPicker({ value, onChange }: Props) {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<import("maplibre-gl").Map | null>(null);
  const markerRef = useRef<import("maplibre-gl").Marker | null>(null);
  const [locating, setLocating] = useState(false);
  const [locError, setLocError] = useState<string | null>(null);
  const [geocoding, setGeocoding] = useState(false);
  const cities = getCityNames();
  const districts = getDistricts(value.city);

  // Haritayı başlat
  useEffect(() => {
    if (!mapContainerRef.current || mapRef.current) return;

    let map: import("maplibre-gl").Map;

    (async () => {
      const maplibre = await import("maplibre-gl");
      await import("maplibre-gl/dist/maplibre-gl.css");

      map = new maplibre.Map({
        container: mapContainerRef.current!,
        style: {
          version: 8,
          sources: {
            osm: {
              type: "raster",
              tiles: [
                "https://a.tile.openstreetmap.org/{z}/{x}/{y}.png",
                "https://b.tile.openstreetmap.org/{z}/{x}/{y}.png",
                "https://c.tile.openstreetmap.org/{z}/{x}/{y}.png",
              ],
              tileSize: 256,
              attribution: "© OpenStreetMap",
            },
          },
          layers: [{ id: "osm", type: "raster", source: "osm" }],
        },
        center: [
          value.longitude ?? DEFAULT_CENTER.lng,
          value.latitude ?? DEFAULT_CENTER.lat,
        ],
        zoom: value.latitude ? 14 : DEFAULT_ZOOM,
      });

      map.addControl(new maplibre.NavigationControl(), "top-right");

      // Haritaya tıklanınca pin koy
      map.on("click", (e) => {
        const { lng, lat } = e.lngLat;
        placeMarker(map, maplibre, lat, lng);
        reverseGeocode(lat, lng);
        onChange({ ...value, latitude: lat, longitude: lng });
      });

      mapRef.current = map;

      // Başlangıç koordinatı varsa marker koy
      if (value.latitude && value.longitude) {
        await map.once("load");
        placeMarker(map, maplibre, value.latitude, value.longitude);
      }
    })();

    return () => {
      mapRef.current?.remove();
      mapRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Koordinat dışarıdan değişince haritayı güncelle
  useEffect(() => {
    if (!mapRef.current || !value.latitude || !value.longitude) return;
    (async () => {
      const maplibre = await import("maplibre-gl");
      const map = mapRef.current!;
      placeMarker(map, maplibre, value.latitude!, value.longitude!);
      map.flyTo({
        center: [value.longitude!, value.latitude!],
        zoom: 15,
        duration: 800,
      });
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value.latitude, value.longitude]);

  function placeMarker(
    map: import("maplibre-gl").Map,
    maplibre: typeof import("maplibre-gl"),
    lat: number,
    lng: number
  ) {
    markerRef.current?.remove();
    const el = document.createElement("div");
    el.className =
      "w-9 h-9 rounded-full bg-orange-600 border-2 border-white shadow-lg flex items-center justify-center text-white text-lg select-none";
    el.innerHTML = "📍";
    markerRef.current = new maplibre.Marker({ element: el, draggable: true })
      .setLngLat([lng, lat])
      .addTo(map);

    markerRef.current.on("dragend", () => {
      const pos = markerRef.current!.getLngLat();
      reverseGeocode(pos.lat, pos.lng);
      onChange({ ...value, latitude: pos.lat, longitude: pos.lng });
    });
  }

  // Nominatim (OSM) ile ters geocoding — adres doldurmak için
  async function reverseGeocode(lat: number, lng: number) {
    setGeocoding(true);
    try {
      const res = await fetch(
        `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json&addressdetails=1&accept-language=tr`,
        { headers: { "User-Agent": "emanetci-app/1.0" } }
      );
      if (!res.ok) return;
      const data = await res.json();
      const addr = data.address ?? {};
      // Nominatim alan adları
      const street =
        [addr.road, addr.neighbourhood, addr.suburb]
          .filter(Boolean)
          .join(", ") || (data.display_name ?? "");
      const nominatimCity =
        addr.province || addr.state || addr.city || addr.county || "";
      const nominatimDistrict =
        addr.city || addr.town || addr.district || addr.borough || "";

      onChange({
        address: street,
        city: nominatimCity,
        district: nominatimDistrict,
        latitude: lat,
        longitude: lng,
      });
    } catch {
      // sessiz hata
    } finally {
      setGeocoding(false);
    }
  }

  // Tarayıcı konum API'si
  function handleLocateMe() {
    if (!navigator.geolocation) {
      setLocError("Tarayıcınız konum desteklemiyor.");
      return;
    }
    setLocating(true);
    setLocError(null);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const { latitude: lat, longitude: lng } = pos.coords;
        onChange({ ...value, latitude: lat, longitude: lng });
        setLocating(false);
      },
      (err) => {
        setLocError(
          err.code === 1
            ? "Konum izni verilmedi. Lütfen tarayıcı ayarlarından izin verin."
            : "Konum alınamadı. Tekrar deneyin."
        );
        setLocating(false);
      },
      { enableHighAccuracy: true, timeout: 10_000 }
    );
  }

  const handleCityChange = (city: string) => {
    onChange({ ...value, city, district: "" });
  };

  return (
    <div className="flex flex-col gap-4">
      {/* Şehir + İlçe */}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2 block">
            Şehir (İl)
          </label>
          <select
            value={value.city}
            onChange={(e) => handleCityChange(e.target.value)}
            className="w-full bg-gray-50 p-3.5 rounded-2xl font-semibold outline-none border border-transparent focus:border-orange-500 transition-all text-sm appearance-none"
          >
            <option value="">İl seçin…</option>
            {cities.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2 block">
            İlçe
          </label>
          <select
            value={value.district}
            onChange={(e) => onChange({ ...value, district: e.target.value })}
            disabled={!value.city}
            className="w-full bg-gray-50 p-3.5 rounded-2xl font-semibold outline-none border border-transparent focus:border-orange-500 transition-all text-sm appearance-none disabled:opacity-40"
          >
            <option value="">İlçe seçin…</option>
            {districts.map((d) => (
              <option key={d} value={d}>
                {d}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Sokak adresi */}
      <div>
        <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2 block">
          Açık Adres
        </label>
        <div className="flex items-start gap-3">
          <MapPin size={20} className="text-gray-300 mt-3.5 shrink-0" />
          <textarea
            value={value.address}
            onChange={(e) => onChange({ ...value, address: e.target.value })}
            rows={2}
            placeholder="Mahalle, cadde, sokak, kapı no…"
            className="flex-1 bg-gray-50 p-4 rounded-2xl font-semibold outline-none border border-transparent focus:border-orange-500 transition-all text-sm resize-none"
          />
        </div>
      </div>

      {/* Harita */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">
            Konumu Haritada Göster
            {geocoding && (
              <span className="ml-2 text-orange-500 normal-case font-medium">
                adres alınıyor…
              </span>
            )}
          </label>
          <button
            type="button"
            onClick={handleLocateMe}
            disabled={locating}
            className="flex items-center gap-1.5 text-xs font-bold text-orange-600 bg-orange-50 hover:bg-orange-100 px-3 py-1.5 rounded-xl transition-all disabled:opacity-60"
          >
            {locating ? (
              <Loader2 size={13} className="animate-spin" />
            ) : (
              <Navigation size={13} />
            )}
            Konumumu Bul
          </button>
        </div>

        {locError && (
          <p className="text-xs text-red-500 font-semibold mb-2">{locError}</p>
        )}

        <div className="relative w-full h-64 rounded-2xl overflow-hidden border border-gray-100 shadow-inner">
          <div ref={mapContainerRef} className="absolute inset-0 w-full h-full" />
          {!value.latitude && (
            <div className="absolute inset-0 flex flex-col items-center justify-center bg-gray-50/80 pointer-events-none gap-2">
              <MapPin size={28} className="text-orange-300" />
              <p className="text-xs text-gray-400 font-semibold">
                Haritaya tıklayarak veya &quot;Konumumu Bul&quot; ile pin ekleyin
              </p>
            </div>
          )}
        </div>

        {value.latitude && value.longitude && (
          <p className="text-[10px] text-gray-400 font-mono mt-1.5">
            {value.latitude.toFixed(6)}, {value.longitude.toFixed(6)}
          </p>
        )}
      </div>
    </div>
  );
}
