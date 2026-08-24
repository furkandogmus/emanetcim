import { describe, it, expect } from "vitest";
import { buildDisallowList } from "@/lib/robots-disallow";

/**
 * `Disallow: /tr/partner` bir ONEK eslesmesidir; "/tr/partners" (herkese
 * acik tanitim sayfasi, bkz. route-protection.ts'teki ayni sinif hata) da
 * bu onekle eslesir ve arama motorlarinin o sayfayi hic dizinlememesine
 * yol acar.
 */
describe("robots.txt disallow listesi", () => {
  it("herkese acik /partners tanitim sayfasini engellemez", () => {
    const list = buildDisallowList(["tr", "en"]);
    expect(list).not.toContain("/tr/partners");
    expect(list.some((r) => r.endsWith("/tr/partners"))).toBe(false);
  });

  it("korumali /partner ve alt yollarini engeller", () => {
    const list = buildDisallowList(["tr"]);
    expect(list).toContain("/tr/partner$");
    expect(list).toContain("/tr/partner/");
  });

  it("her dil icin ayni disallow setini uretir", () => {
    const list = buildDisallowList(["tr", "en", "de"]);
    for (const locale of ["tr", "en", "de"]) {
      expect(list).toContain(`/${locale}/admin`);
      expect(list).toContain(`/${locale}/bookings`);
      expect(list).toContain(`/${locale}/checkout`);
      expect(list).toContain(`/${locale}/account`);
      expect(list).toContain(`/${locale}/auth`);
    }
  });
});
