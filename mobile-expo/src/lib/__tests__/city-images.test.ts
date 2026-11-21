import { describe, expect, it } from "@jest/globals";

import { cityImage, citySlug } from "@/lib/city-images";

describe("cityImage", () => {
  it("yazim bicimi fark etmez: Istanbul / İstanbul / ISTANBUL ayni fotograf", () => {
    const ref = cityImage({ name: "İstanbul" });
    expect(ref).toBeDefined();
    expect(cityImage({ name: "Istanbul" })).toBe(ref);
    expect(cityImage({ name: "ISTANBUL" })).toBe(ref);
    expect(cityImage({ name: "x", slug: "istanbul" })).toBe(ref);
    expect(cityImage({ name: "Mugla" })).toBe(cityImage({ name: "Muğla" }));
  });

  it("tanimsiz sehirde undefined", () => {
    expect(cityImage({ name: "Sivas" })).toBeUndefined();
    expect(citySlug("Şanlıurfa")).toBe("sanliurfa");
  });
});
