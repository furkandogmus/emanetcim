import { describe, it, expect } from "vitest";
import fs from "node:fs";
import { buildDirectionsUrl } from "@/lib/directions-url";

/**
 * "YOL TARİFİ" — misafirin valizini taşırken bastığı düğme.
 *
 * NEDEN TEK KAYNAK (2026-08-31): üç yüzey üç ayrı şekilde yazıyordu ve biri
 * ayrışmıştı. Arama kartı ve dükkan detayı KOORDİNAT gönderiyordu; rezervasyon
 * sayfası ise `shopAddress` METNİNİ. Fark tam da en kritik anda ortaya çıkıyor:
 * adres metni Google tarafında yeniden geocode ediliyor ve bizim `address`
 * alanımız çoğu zaman ilçe/şehir kadar kaba ("Sultanahmet, İstanbul" — talep
 * testi noktalarının adresi tam olarak böyle kuruluyor) ya da esnafın elle
 * yazdığı serbest metin.
 *
 * Yani elimizde kesin koordinat dururken misafir tahmini bir noktaya
 * yönlendirilebiliyordu.
 */
describe("buildDirectionsUrl", () => {
  it("koordinat varsa KOORDINAT kullanir", () => {
    const url = buildDirectionsUrl({
      latitude: 41.00652,
      longitude: 28.97598,
      address: "Sultanahmet, İstanbul",
    });
    expect(url).toContain("destination=41.00652,28.97598");
    expect(url).not.toContain("Sultanahmet");
  });

  it("koordinat yoksa adres metnine duser", () => {
    const url = buildDirectionsUrl({ address: "Sultanahmet, İstanbul" });
    expect(url).toContain("destination=Sultanahmet%2C%20%C4%B0stanbul");
  });

  it("ikisi de yoksa BAGLANTI URETMEZ", () => {
    // Calismayan bir "Yol Tarifi" dugmesi, olmayan dugmeden kotudur.
    expect(buildDirectionsUrl({})).toBeNull();
    expect(buildDirectionsUrl({ address: "   " })).toBeNull();
  });

  it("gecersiz koordinati koordinat saymaz", () => {
    const url = buildDirectionsUrl({
      latitude: Number.NaN,
      longitude: 28.9,
      address: "Kadıköy",
    });
    expect(url).toContain("Kad");
  });

  it("yol tarifi cizen HER yuzey ayni kaynagi kullanir", () => {
    /**
     * Ayrışmanın kendisi hataydı; mandal onu geri gelmesin diye ölçüyor.
     */
    const files = [
      "src/components/guest/BookingDetailActions.tsx",
      "src/components/guest/ShopDetailClient.tsx",
      "src/components/guest/ShopListItem.tsx",
    ];
    for (const f of files) {
      const src = fs.readFileSync(f, "utf8");
      expect(src, `${f}: elle maps/dir yaziyor`).not.toMatch(
        /maps\/dir\/\?api=1&destination=/,
      );
      expect(src, `${f}: buildDirectionsUrl kullanmiyor`).toContain(
        "buildDirectionsUrl",
      );
    }
  });
});
