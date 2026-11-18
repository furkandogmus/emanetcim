import { describe, expect, it } from "@jest/globals";

import { appPathFromLink } from "@/lib/app-link-path";

describe("appPathFromLink", () => {
  it("dukkan baglantisi dil onekini atar", () => {
    expect(appPathFromLink("https://bagajpark.com/tr/shop/cmabc123")).toBe("/shop/cmabc123");
    expect(appPathFromLink("https://www.bagajpark.com/en/shop/cmabc123?x=1")).toBe("/shop/cmabc123");
  });

  it("dukkan disindaki site yolu ana ekrana duser", () => {
    expect(appPathFromLink("https://bagajpark.com/tr/bookings/bk_1")).toBe("/");
  });

  it("uygulama ici ve yabanci yollar degismez", () => {
    expect(appPathFromLink("/shop/abc")).toBe("/shop/abc");
    expect(appPathFromLink("bagajpark://bookings/1")).toBe("bagajpark://bookings/1");
    expect(appPathFromLink("https://example.com/tr/shop/abc")).toBe("https://example.com/tr/shop/abc");
  });
});
