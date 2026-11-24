import { describe, expect, it } from "@jest/globals";

import { activeFilterCount, DEFAULT_FILTERS, filterParams } from "@/lib/search";

describe("arama suzgeci", () => {
  it("varsayilan: yalniz siralama gider, rozet 0", () => {
    expect(filterParams(DEFAULT_FILTERS)).toEqual({ sort: "distance" });
    expect(activeFilterCount(DEFAULT_FILTERS)).toBe(0);
  });

  it("secilenler sunucu parametrelerine cevrilir; siralama rozete sayilmaz", () => {
    const f = { sort: "price_asc" as const, cctv: true, climate: false, largeItems: true, maxPrice: 300, minRating: 4 };
    expect(filterParams(f)).toEqual({ sort: "price_asc", cctv: "1", largeItems: "1", maxPrice: "300", minRating: "4" });
    expect(activeFilterCount(f)).toBe(4);
  });
});
