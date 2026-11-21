import { describe, expect, it } from "@jest/globals";
import type { TFunction } from "i18next";

import { shopPriceA11y, stayLabel } from "../shop-label";

const t = ((k: string) => (k === "map.comingSoon" ? "COMING" : k === "map.perDayMedium" ? "PERDAY" : k)) as unknown as TFunction;

describe("shopPriceA11y", () => {
  it("rezerve edilebilir dukkanda fiyat ve gunluk birim okunur", () => {
    const label = shopPriceA11y({ isPrelaunch: false, priceRange: { medium: 120 } as never, pricePerDay: 100 }, t);
    expect(label).toContain("120");
    expect(label).toContain("PERDAY");
  });

  it("aralik yoksa pricePerDay'e duser", () => {
    expect(shopPriceA11y({ isPrelaunch: false, pricePerDay: 90 }, t)).toContain("90");
  });

  it("talep testi dukkaninda fiyat yerine Yakinda okunur", () => {
    expect(shopPriceA11y({ isPrelaunch: true, pricePerDay: 90 }, t)).toBe("COMING");
  });
});

describe("kalis toplami (stayQuote)", () => {
  const tt = ((k: string, o?: Record<string, unknown>) =>
    k === "map.stayTotalA11y"
      ? `TOTAL ${o?.price} / ${o?.stay}`
      : k === "map.stayFor"
        ? `${o?.days}+${o?.bags}`
        : k === "common.day"
          ? `${o?.count}d`
          : k === "common.bag"
            ? `${o?.count}b`
            : k === "map.perDayMedium"
              ? "PERDAY"
              : k) as unknown as TFunction;

  it("sunucu toplami once, gunluk fiyat sonra okunur", () => {
    const label = shopPriceA11y(
      { isPrelaunch: false, pricePerDay: 100, priceRange: { min: 80, max: 150, medium: 100 }, stayQuote: { total: 420, days: 2, bags: 3 } },
      tt,
    );
    expect(label).toMatch(/^TOTAL .*420.* \/ 2d\+3b, .*100.* PERDAY$/);
  });

  it("stayLabel gun ve adedi sunucunun saydigi gibi yazar", () => {
    expect(stayLabel({ total: 1, days: 3, bags: 1 }, tt)).toBe("3d+1b");
  });

  it("talep testi noktasinda toplam olsa bile Yakinda okunur", () => {
    expect(shopPriceA11y({ isPrelaunch: true, pricePerDay: 1, stayQuote: { total: 9, days: 1, bags: 1 } }, t)).toBe("COMING");
  });
});
