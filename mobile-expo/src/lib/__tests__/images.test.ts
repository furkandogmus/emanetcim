import { describe, expect, it } from "@jest/globals";

import { SITE_ORIGIN, resolveImage } from "@/lib/images";

describe("resolveImage", () => {
  it("mutlak ve data URL olduğu gibi kalır", () => {
    const s3 = "https://bucket.s3.eu-central-1.amazonaws.com/shops/a.jpg";
    expect(resolveImage(s3)).toBe(s3);
    expect(resolveImage("data:image/png;base64,AAAA")).toBe("data:image/png;base64,AAAA");
  });

  it("göreli yol site köküne bağlanır, /api/mobile eki düşer", () => {
    expect(SITE_ORIGIN.endsWith("/api/mobile")).toBe(false);
    expect(resolveImage("/uploads/shop.jpg")).toBe(`${SITE_ORIGIN}/uploads/shop.jpg`);
  });

  it("boş ya da tanınmayan değer görsel üretmez", () => {
    expect(resolveImage(null)).toBeNull();
    expect(resolveImage("")).toBeNull();
    expect(resolveImage("javascript:alert(1)")).toBeNull();
    expect(resolveImage("shops/a.jpg")).toBeNull();
  });
});
