import { describe, it, expect } from "vitest";
import { parseCoordinates } from "@/lib/coordinates";

/**
 * Admin esnaf eklerken konumu yapıştırıyor (bkz. `src/lib/coordinates.ts`).
 * Yanlış okunan bir konum, aramada yanlış yerde görünen bir dükkan demek.
 */
describe("parseCoordinates", () => {
  it.each([
    ["36.622931, 29.108484", 36.622931, 29.108484],
    ["36.622931 29.108484", 36.622931, 29.108484],
    ["  36.622931,29.108484  ", 36.622931, 29.108484],
    ["https://www.google.com/maps?q=36.622931,29.108484", 36.622931, 29.108484],
    ["https://maps.google.com/?q=36.54822699814878,31.998707814755914", 36.54822699814878, 31.998707814755914],
    ["https://www.google.com/maps/search/?api=1&query=41.0256%2C28.9744", 41.0256, 28.9744],
    ["https://www.google.com/maps/@41.0256,28.9744,17z", 41.0256, 28.9744],
    ["https://www.google.com/maps/place/X/@-33.86,151.20,17z", -33.86, 151.2],
  ])("%s", (input, latitude, longitude) => {
    expect(parseCoordinates(input)).toEqual({ latitude, longitude });
  });

  it("paylaşılan yer linkinde işaretçi (!3d/!4d) harita merkezine (@) üstün gelir", () => {
    const url =
      "https://www.google.com/maps/place/Kitaphane/@36.6200,29.1100,17z/data=!3m1!4b1!4m6!3m5!1s0x0:0x0!8m2!3d36.622931!4d29.108484";
    expect(parseCoordinates(url)).toEqual({ latitude: 36.622931, longitude: 29.108484 });
  });

  it.each([
    [""],
    ["   "],
    [null],
    [undefined],
    ["Lale Sk. No:9 Alanya"],
    ["https://maps.app.goo.gl/AbCdEf123"], // kısa link: yönlendirme çözülmez
    ["95, 29"], // enlem aralık dışı
    ["36, 190"], // boylam aralık dışı
    ["0, 0"], // boş alanın sayıya dönmüş hali
  ])("okunamayanı null döner: %s", (input) => {
    expect(parseCoordinates(input)).toBeNull();
  });
});
