import { describe, expect, it } from "@jest/globals";
import type { TFunction } from "i18next";

import { shopPriceA11y } from "../shop-label";

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
