import { describe, it, expect } from "vitest";
import { getMapStyle, MAP_STYLE_URL } from "@/lib/map-style";

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
