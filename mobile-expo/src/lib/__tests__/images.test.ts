import { describe, expect, it } from "@jest/globals";

import { SITE_ORIGIN, resolveImage, thumbUrl } from "@/lib/images";

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

describe("thumbUrl", () => {
  it("mutlak adresi gorsel ucuna, gerekli genisligin ustundeki ilk kabul edilen boyutla verir", () => {
    const u = thumbUrl("https://cdn.example.com/shops/a.jpg", 64, 3);
    expect(u).toContain("/_next/image?url=https%3A%2F%2Fcdn.example.com%2Fshops%2Fa.jpg&w=256&q=70");
  });
  it("goreli yolu oldugu gibi, data URL'yi dokunmadan birakir", () => {
    expect(thumbUrl("/uploads/x.png", 400, 2)).toContain("url=%2Fuploads%2Fx.png&w=828");
    expect(thumbUrl("data:image/png;base64,AA", 64)).toBe("data:image/png;base64,AA");
    expect(thumbUrl(null, 64)).toBeNull();
  });
});
