import { describe, it, expect } from "vitest";
import { citySlug } from "@/lib/city-slug";

describe("citySlug", () => {
  it("yazim bicimini yok sayar", () => {
    for (const v of ["İstanbul", "Istanbul", "ISTANBUL", "istanbul", " ıstanbul "]) {
      expect(citySlug(v)).toBe("istanbul");
    }
    expect(citySlug("Muğla")).toBe("mugla");
    expect(citySlug("Şanlıurfa")).toBe("sanliurfa");
    expect(citySlug("Afyon Karahisar")).toBe("afyon-karahisar");
  });
});
