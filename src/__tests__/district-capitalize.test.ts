import { describe, expect, it } from "vitest";
import { capitalizeDistrict } from "@/services/CityCoverageService";

describe("capitalizeDistrict", () => {
  it("kucuk harfle girilmis ilce adinin her kelimesini Turkce kurala gore buyutur", () => {
    expect(capitalizeDistrict("yenimahalle")).toBe("Yenimahalle");
    expect(capitalizeDistrict("ıspartakule")).toBe("Ispartakule");
    expect(capitalizeDistrict("istanbul havalimanı")).toBe("İstanbul Havalimanı");
    expect(capitalizeDistrict("bayrampaşa-esenler")).toBe("Bayrampaşa-Esenler");
  });
  it("dogru yazilmis adlara dokunmaz", () => {
    expect(capitalizeDistrict("Beyoğlu")).toBe("Beyoğlu");
    expect(capitalizeDistrict("Kızılay")).toBe("Kızılay");
    expect(capitalizeDistrict("ÇANKAYA")).toBe("ÇANKAYA");
  });
});
