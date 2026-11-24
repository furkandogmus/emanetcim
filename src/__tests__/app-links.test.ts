import { describe, expect, it } from "vitest";

import { appLinkComponents, appleAppSiteAssociation, assetLinks } from "@/lib/app-links";

const FP = Array.from({ length: 32 }, () => "AB").join(":");

describe("app links", () => {
  it("parmak izi yoksa assetlinks yayinlanmaz", () => {
    expect(assetLinks({} as unknown as NodeJS.ProcessEnv)).toBeNull();
    expect(assetLinks({ ANDROID_APP_LINK_SHA256: "bozuk" } as unknown as NodeJS.ProcessEnv)).toBeNull();
  });

  it("gecerli parmak izleriyle com.bagajpark icin yayinlanir", () => {
    const body = assetLinks({ ANDROID_APP_LINK_SHA256: `${FP.toLowerCase()}, ${FP}` } as unknown as NodeJS.ProcessEnv);
    expect(body?.[0].target).toEqual({ namespace: "android_app", package_name: "com.bagajpark", sha256_cert_fingerprints: [FP, FP] });
  });

  it("Team ID yoksa AASA yayinlanmaz; varsa yol kurallari yayinlanir", () => {
    expect(appleAppSiteAssociation({} as unknown as NodeJS.ProcessEnv)).toBeNull();
    const body = appleAppSiteAssociation({ APPLE_TEAM_ID: "ABCDE12345" } as unknown as NodeJS.ProcessEnv);
    expect(body?.applinks.details[0].appIDs).toEqual(["ABCDE12345.com.bagajpark"]);
    expect(body?.applinks.details[0].components).toEqual(appLinkComponents());
    // Gecerli JSON: yalnizca "/", "?" ve exclude anahtarlari.
    for (const c of appLinkComponents()) {
      expect(Object.keys(c).every((k) => ["/", "?", "exclude"].includes(k))).toBe(true);
      expect(c["/"].startsWith("/")).toBe(true);
    }
  });

  /*
    Apple'in eslemesi: kurallar sirayla, ilk eslesen kazanir; `*` her karakteri
    (egik cizgi dahil), `?` tek karakteri tutar; "?" sozlugundeki her anahtar URL'de olmali.
  */
  function glob(p: string): RegExp {
    return new RegExp(`^${p.replace(/[.+^${}()|[\]\\]/g, "\\$&").replace(/\*/g, ".*").replace(/\?/g, ".")}$`);
  }
  function opensApp(href: string): boolean {
    const url = new URL(href, "https://bagajpark.com");
    for (const c of appLinkComponents()) {
      if (!glob(c["/"]).test(url.pathname)) continue;
      const query = c["?"] ?? {};
      const ok = Object.entries(query).every(([k, v]) => url.searchParams.has(k) && glob(v).test(url.searchParams.get(k) ?? ""));
      if (!ok) continue;
      return !c.exclude;
    }
    return false;
  }

  it.each([
    ["/tr/shop/cmabc123", true],
    ["/en/shop/cmabc123?aff=OTEL1", true],
    ["/tr/bookings/0f8fad5b-d9cb-469f-a165-70867728950e", true],
    ["/de/partner/bookings/0f8fad5b-d9cb-469f-a165-70867728950e", true],
    ["/tr/account/affiliate", true],
    ["/tr/register", true],
    ["/tr/register?ref=ABCD2345", true],
    ["/tr/register?role=PARTNER&ref=ABCD2345", false],
    ["/tr/register?role=partner", false],
    ["/tr/register?partnerref=ABCD2345", false],
    ["/tr/bookings/lookup", false],
    ["/tr/bookings/manage/eyJhbGciOi", false],
    ["/tr/bookings/0f8fad5b-d9cb-469f-a165-70867728950e/dispute", false],
    ["/tr/bookings", false],
    ["/tr/partner/bookings", false],
    ["/tr/admin/bookings/0f8fad5b-d9cb-469f-a165-70867728950e", false],
    ["/tr/auth/new-password?token=x", false],
    ["/tr/auth/verify-email?token=x", false],
    ["/tr/account", false],
    ["/app", false],
  ])("%s -> uygulama: %s", (href, expected) => {
    expect(opensApp(href)).toBe(expected);
  });
});
