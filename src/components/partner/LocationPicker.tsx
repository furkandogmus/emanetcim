"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { Navigation, Loader2, MapPin, CheckCircle2 } from "lucide-react";
import { TR_CITIES } from "@/lib/tr-cities";

export interface LocationValue {
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

const TR_CENTER = { lat: 39.0, lng: 35.0 };

/** Nominatim'den gelen il/ilçe adını TR_CITIES listesiyle eşleştir */
function matchCity(raw: string): string {
  if (!raw) return "";
  const norm = (s: string) =>
    s.toLocaleLowerCase("tr").replace(/[^a-zçğıöşü]/g, "");
  const r = norm(raw);
  const hit = TR_CITIES.find((c) => norm(c.name) === r);
  return hit?.name ?? raw;
}

function matchDistrict(cityName: string, raw: string): string {
  if (!raw || !cityName) return raw;
  const norm = (s: string) =>
    s.toLocaleLowerCase("tr").replace(/[^a-zçğıöşü]/g, "");
  const r = norm(raw);
  const city = TR_CITIES.find((c) => c.name === cityName);
  if (!city) return raw;
  const hit = city.districts.find((d) => norm(d) === r);
  return hit ?? raw;
}

/** Nominatim reverse geocoding → LocationValue */
async function reverseGeocode(lat: number, lng: number): Promise<Partial<LocationValue>> {
  const res = await fetch(
    `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json&addressdetails=1&accept-language=tr`,
    { headers: { "User-Agent": "emanetci-app/1.0" } }
  );
  if (!res.ok) return {};
  const data = await res.json();
  const a = data.address ?? {};

  // TR: state = il, county/town/city_district = ilçe
  const rawCity = a.state || a.province || a.city || "";
  const rawDistrict = a.county || a.city_district || a.town || a.city || "";

  const city = matchCity(rawCity);
  const district = matchDistrict(city, rawDistrict);

  const addressParts = [
    a.road,
    a.neighbourhood || a.suburb,
    a.house_number,
  ].filter(Boolean);
  const address = addressParts.join(" ") || a.display_name || "";

  return { city, district, address, latitude: lat, longitude: lng };
}

export default function LocationPicker({ value, onChange }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<import("maplibre-gl").Map | null>(null);
  const markerRef = useRef<import("maplibre-gl").Marker | null>(null);
  const onChangeRef = useRef(onChange);
  useEffect(() => { onChangeRef.current = onChange; }, [onChange]);

  const [locating, setLocating] = useState(false);
  const [geocoding, setGeocoding] = useState(false);
  const [locError, setLocError] = useState<string | null>(null);
  const [confirmed, setConfirmed] = useState(!!value.latitude);

  /* ── Marker yardımcısı ── */
  const placeMarker = useCallback(
    (
      map: import("maplibre-gl").Map,
      maplibre: typeof import("maplibre-gl"),
      lat: number,
      lng: number
    ) => {
      markerRef.current?.remove();
      const el = document.createElement("div");
      el.style.cssText = `
        width:40px;height:40px;border-radius:50% 50% 50% 0;
        background:#ea580c;border:3px solid #fff;
        box-shadow:0 4px 12px rgba(0,0,0,.25);
        transform:rotate(-45deg);cursor:grab;
      `;
      const inner = document.createElement("div");
      inner.style.cssText = `
        width:100%;height:100%;border-radius:50% 50% 50% 0;
        display:flex;align-items:center;justify-content:center;
        transform:rotate(45deg);font-size:18px;
      `;
      inner.textContent = "📍";
      el.appendChild(inner);

      const marker = new maplibre.Marker({ element: el, draggable: true })
        .setLngLat([lng, lat])
        .addTo(map);

      marker.on("dragend", async () => {
        const pos = marker.getLngLat();
        setGeocoding(true);
        try {
          const geo = await reverseGeocode(pos.lat, pos.lng);
          onChangeRef.current({ address: "", city: "", district: "", ...geo, latitude: pos.lat, longitude: pos.lng });
          setConfirmed(true);
        } finally {
          setGeocoding(false);
        }
      });

      markerRef.current = marker;
    },
    []
  );

  /* ── Haritayı başlat ── */
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    let map: import("maplibre-gl").Map;

    (async () => {
      const maplibre = await import("maplibre-gl");
      await import("maplibre-gl/dist/maplibre-gl.css");

      map = new maplibre.Map({
        container: containerRef.current!,
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
        center: [value.longitude ?? TR_CENTER.lng, value.latitude ?? TR_CENTER.lat],
        zoom: value.latitude ? 15 : 5.5,
        attributionControl: false,
      });

      map.addControl(new maplibre.NavigationControl({ showCompass: false }), "bottom-right");

      map.on("click", async (e) => {
        const { lng, lat } = e.lngLat;
        placeMarker(map, maplibre, lat, lng);
        setGeocoding(true);
        try {
          const geo = await reverseGeocode(lat, lng);
          onChangeRef.current({ address: "", city: "", district: "", ...geo, latitude: lat, longitude: lng });
          setConfirmed(true);
        } finally {
          setGeocoding(false);
        }
      });

      mapRef.current = map;

      if (value.latitude && value.longitude) {
        map.once("load", () => {
          placeMarker(map, maplibre, value.latitude!, value.longitude!);
        });
      }
    })();

    return () => {
      mapRef.current?.remove();
      mapRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* ── Dışarıdan koordinat gelince fly + marker ── */
  useEffect(() => {
    if (!mapRef.current || !value.latitude || !value.longitude) return;
    (async () => {
      const maplibre = await import("maplibre-gl");
      placeMarker(mapRef.current!, maplibre, value.latitude!, value.longitude!);
      mapRef.current!.flyTo({
        center: [value.longitude!, value.latitude!],
        zoom: 16,
        duration: 1000,
        essential: true,
      });
    })();
  }, [value.latitude, value.longitude, placeMarker]);

  /* ── GPS ── */
  const handleLocateMe = useCallback(() => {
    if (!navigator.geolocation) {
      setLocError("Tarayıcınız konum desteklemiyor.");
      return;
    }
    setLocating(true);
    setLocError(null);
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const { latitude: lat, longitude: lng } = pos.coords;
        setGeocoding(true);
        try {
          const geo = await reverseGeocode(lat, lng);
          onChangeRef.current({ address: "", city: "", district: "", ...geo, latitude: lat, longitude: lng });
          setConfirmed(true);
        } catch {
          onChangeRef.current({ address: "", city: "", district: "", latitude: lat, longitude: lng });
          setConfirmed(true);
        } finally {
          setGeocoding(false);
          setLocating(false);
        }
      },
      (err) => {
        setLocError(
          err.code === 1
            ? "Konum izni reddedildi. Tarayıcı ayarlarından izin verin."
            : "Konum alınamadı, tekrar deneyin."
        );
        setLocating(false);
      },
      { enableHighAccuracy: true, timeout: 12_000 }
    );
  }, []);

  const isLoading = locating || geocoding;

  return (
    <div className="flex flex-col gap-3">
      {/* ── Konumumu Bul butonu ── */}
      <button
        type="button"
        onClick={handleLocateMe}
        disabled={isLoading}
        className="w-full flex items-center justify-center gap-2.5 bg-orange-600 hover:bg-orange-700 disabled:opacity-60 text-white font-black rounded-2xl py-4 transition-all active:scale-95 shadow-lg shadow-orange-200"
      >
        {locating ? (
          <Loader2 size={20} className="animate-spin" />
        ) : geocoding ? (
          <Loader2 size={20} className="animate-spin" />
        ) : (
          <Navigation size={20} />
        )}
        {locating ? "Konum alınıyor…" : geocoding ? "Adres tespit ediliyor…" : "Konumumu Bul"}
      </button>

      {locError && (
        <p className="text-xs text-red-500 font-semibold text-center -mt-1">{locError}</p>
      )}

      {/* ── Harita ── */}
      <div className="relative w-full h-56 rounded-2xl overflow-hidden border border-gray-100 shadow-sm">
        <div ref={containerRef} className="absolute inset-0 w-full h-full" />

        {/* Overlay: konum seçilmediyse ipucu */}
        {!value.latitude && !isLoading && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 pointer-events-none">
            <div className="bg-white/90 backdrop-blur-sm rounded-2xl px-4 py-3 flex flex-col items-center gap-1 shadow-sm">
              <MapPin size={22} className="text-orange-400" />
              <p className="text-xs text-gray-500 font-semibold">
                Butona bas veya haritaya tıkla
              </p>
            </div>
          </div>
        )}

        {/* Overlay: geocoding spinner */}
        {geocoding && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/10 backdrop-blur-[1px]">
            <div className="bg-white rounded-2xl px-4 py-3 flex items-center gap-2 shadow-lg">
              <Loader2 size={16} className="animate-spin text-orange-500" />
              <span className="text-xs font-bold text-gray-700">Adres tespit ediliyor…</span>
            </div>
          </div>
        )}
      </div>

      {/* ── Tespit edilen adres bilgisi ── */}
      {confirmed && value.latitude && (
        <div className="bg-orange-50 border border-orange-100 rounded-2xl p-4 flex flex-col gap-2">
          <div className="flex items-center gap-2">
            <CheckCircle2 size={15} className="text-orange-500 shrink-0" />
            <span className="text-[11px] font-black text-orange-600 uppercase tracking-widest">
              Konum Tespit Edildi
            </span>
          </div>

          <div className="flex flex-wrap gap-2 mt-0.5">
            {value.city && (
              <span className="bg-white border border-orange-200 text-gray-700 text-xs font-bold px-3 py-1 rounded-xl">
                📍 {value.city}
              </span>
            )}
            {value.district && (
              <span className="bg-white border border-orange-200 text-gray-700 text-xs font-bold px-3 py-1 rounded-xl">
                {value.district}
              </span>
            )}
          </div>

          {value.address && (
            <p className="text-xs text-gray-500 font-medium leading-snug mt-0.5">
              {value.address}
            </p>
          )}

          <p className="text-[10px] text-gray-400 font-mono">
            {value.latitude.toFixed(5)}, {value.longitude!.toFixed(5)}
          </p>

          <button
            type="button"
            onClick={() => {
              onChange({ address: "", city: "", district: "", latitude: null, longitude: null });
              setConfirmed(false);
              markerRef.current?.remove();
              markerRef.current = null;
              mapRef.current?.flyTo({ center: [TR_CENTER.lng, TR_CENTER.lat], zoom: 5.5, duration: 800 });
            }}
            className="text-[11px] text-gray-400 hover:text-red-500 font-semibold mt-1 self-start transition-colors"
          >
            Konumu sıfırla
          </button>
        </div>
      )}
    </div>
  );
}
