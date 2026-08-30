import { describe, it, expect } from "vitest";
import fs from "node:fs";
import { getMapStyle, MAP_STYLE_URL, MAP_ATTRIBUTION } from "@/lib/map-style";

/**
 * Harita altlığı seçimi.
 *
 * NEDEN TEST EDİLİYOR: bu kod yolunun bozulması SESSİZ değil ama geç fark
 * ediliyor — misafirin gördüğü arama haritası aylarca üzerinde
 * "API KEY REQUIRED" filigranı olan karolarla çalıştı. Kimse hata almadı,
 * sayfa da açıldı; sadece harita ucuz göründü.
 */
describe("getMapStyle", () => {
  it("hicbir yapilandirma olmadan calisan bir altlik dondurur", () => {
    // Kritik: altlik ANAHTAR BEKLEMEMELI. Anahtar bekleyen bir varsayilan,
    // haritayi filigranli birakan durumun ta kendisiydi.
    expect(getMapStyle()).toBe(MAP_STYLE_URL);
    expect(MAP_STYLE_URL).toMatch(/^https:\/\//);
  });

  it("anahtar isteyen CARTO karo ucuna donmez", () => {
    expect(getMapStyle()).not.toContain("cartocdn.com");
    expect(getMapStyle()).not.toContain("api_key");
  });

  it("ham OSM karo sunucusu kullanilmaz", () => {
    // `tile.openstreetmap.org` politikasi ticari servisleri acikca uyariyor
    // ("access may be withdrawn at any point") ve uygulamaya ozgu User-Agent
    // sart kosuyor -- tarayicidaki bir harita bunu yapamaz.
    expect(getMapStyle()).not.toContain("tile.openstreetmap.org");
  });
});

/**
 * Atıf bir tercih değil, LİSANS ŞARTI (ODbL).
 *
 * NEDEN MANDAL: 2026-08-31'de canlıda ölçüldü — atıf kutusunda yalnızca
 * "MapLibre" yazıyordu, tek satır OpenStreetMap kredisi yoktu. Sebep, atfın
 * sağlayıcının TileJSON'ından gelmesiydi: o zincir koptuğunda atıf da sessizce
 * kayboluyor. `LocationPicker` ise `attributionControl: false` ile kutuyu
 * tamamen kapatmıştı. İkisinin ortak yanı, hatanın HİÇBİR belirti üretmemesi —
 * harita çalışmaya devam ediyor, yalnızca kredi kayboluyor.
 */
describe("harita atfi", () => {
  it("OpenStreetMap kredisi ve telif baglantisi tasir", () => {
    expect(MAP_ATTRIBUTION).toContain("OpenStreetMap");
    expect(MAP_ATTRIBUTION).toContain("openstreetmap.org/copyright");
  });

  it("harita cizen her bilesen atfi ACIKCA verir", () => {
    // Sağlayıcının otomatik atfına güvenmek yetmiyor; her `new maplibregl.Map`
    // çağrısı `customAttribution` ile kendi kredisini taşımalı.
    const files = [
      "src/components/guest/SearchMap.tsx",
      "src/components/partner/LocationPicker.tsx",
    ];
    for (const f of files) {
      const src = fs.readFileSync(f, "utf8");
      expect(src, `${f}: atif kapatilmis`).not.toContain("attributionControl: false");
      expect(src, `${f}: customAttribution yok`).toContain("customAttribution");
      expect(src, `${f}: MAP_ATTRIBUTION kullanilmiyor`).toContain("MAP_ATTRIBUTION");
    }
  });
});
