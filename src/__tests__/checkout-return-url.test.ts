import { describe, it, expect } from "vitest";
import {
  buildCheckoutReturnPath,
  checkoutAuthHref,
  parseCheckoutSelectionParams,
} from "@/lib/checkout-return-url";
import { sanitizeAuthCallbackUrl } from "@/lib/auth-callback-url";

describe("checkout donus adresi (giris/kayit gidis-donusu)", () => {
  const sel = { checkIn: "2030-05-01", checkOut: "2030-05-03", bagS: 1, bagM: 2, bagXl: 0, couponCode: "YAZ10" };

  it("dukkan, gunler, valizler ve kupon donus yolunda; secim aynen geri okunur", () => {
    const path = buildCheckoutReturnPath("en", "shop-1", sel);
    expect(path).toBe("/en/checkout/shop-1?checkIn=2030-05-01&checkOut=2030-05-03&bagS=1&bagM=2&bagXl=0&coupon=YAZ10");
    const sp = Object.fromEntries(new URL(path, "https://x.invalid").searchParams);
    expect(parseCheckoutSelectionParams(sp)).toEqual(sel);
  });

  it("donus yolu giris ekraninin suzgecinden degismeden gecer", () => {
    const path = buildCheckoutReturnPath("tr", "shop-1", sel);
    expect(sanitizeAuthCallbackUrl(path)).toBe(path);
    const href = checkoutAuthHref("login", path);
    expect(href).toBe(`/login?callbackUrl=${encodeURIComponent(path)}`);
    expect(sanitizeAuthCallbackUrl(new URL(href, "https://x.invalid").searchParams.get("callbackUrl"))).toBe(path);
  });

  it("dis siteye giden donus adresi uretilmez", () => {
    for (const evil of ["//evil.com/x", "/\\evil.com", "https://evil.com/phish", "javascript:alert(1)"]) {
      const href = checkoutAuthHref("register", evil);
      const cb = new URL(href, "https://bagajpark.test").searchParams.get("callbackUrl");
      if (cb) {
        expect(new URL(cb, "https://bagajpark.test").origin).toBe("https://bagajpark.test");
      } else {
        expect(href).toBe("/register");
      }
    }
  });

  it("dukkan kimligindeki ozel karakterler yolu kaciramaz", () => {
    const path = buildCheckoutReturnPath("tr", "../../evil?x=1#", {});
    expect(path.startsWith("/tr/checkout/")).toBe(true);
    expect(new URL(path, "https://bagajpark.test").pathname.startsWith("/tr/checkout/")).toBe(true);
  });

  it("bozuk parametreler yok sayilir; eski ?bags= orta boy sayisidir", () => {
    expect(
      parseCheckoutSelectionParams({ checkIn: "2030-02-30", bagS: "-1", bagXl: "99", bags: "3", coupon: "   " }),
    ).toEqual({ checkIn: null, checkOut: null, bagS: undefined, bagM: 3, bagXl: undefined, couponCode: null });
  });
});
