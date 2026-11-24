import { describe, expect, it } from "vitest";

import { readFileSync } from "node:fs";
import { join } from "node:path";

import { APP_LINK_PATHS, appLinkComponents, appleAppSiteAssociation, assetLinks } from "@/lib/app-links";

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

/*
  Android App Links: `mobile-expo/app.json` intentFilters. Android'in PATTERN_SIMPLE_GLOB'u
  yalniz `.` ve `.*` bilir, geri izleme yapmaz (`.*` sonraki harfe kadar yer) ve dislama
  yoktur; bu yuzden rezervasyon yolu UUID uzunlugunda kalipla sinirlanir. Kayit (`/register`)
  Android'de bilerek yok: davet `?ref=`/`?role=` sorgusuna bagli ve intent filtresi sorguyu
  okuyamaz.
*/
describe("android intent filters", () => {
  type Data = { scheme?: string; host?: string; pathPattern?: string };
  const app = JSON.parse(readFileSync(join(process.cwd(), "mobile-expo/app.json"), "utf8")) as {
    expo: { android: { intentFilters: { autoVerify?: boolean; data: Data[] }[] } };
  };
  const filters = app.expo.android.intentFilters;

  // android.os.PatternMatcher.matchGlobPattern (kacis karakteri olmadan).
  function androidGlob(pattern: string, match: string): boolean {
    const NP = pattern.length;
    const NM = match.length;
    if (NP === 0) return NM === 0;
    let ip = 0;
    let im = 0;
    let next = pattern[0];
    while (ip < NP && im < NM) {
      const c = next;
      ip++;
      next = ip < NP ? pattern[ip] : "";
      if (next === "*") {
        if (c === ".") {
          if (ip >= NP - 1) return true;
          ip++;
          next = pattern[ip];
          while (im < NM && match[im] !== next) im++;
          if (im === NM) return false;
          ip++;
          next = ip < NP ? pattern[ip] : "";
          im++;
        } else {
          while (im < NM && match[im] === c) im++;
          ip++;
          next = ip < NP ? pattern[ip] : "";
        }
      } else {
        if (c !== "." && match[im] !== c) return false;
        im++;
      }
    }
    if (ip >= NP && im >= NM) return true;
    return ip === NP - 2 && pattern[ip] === "." && pattern[ip + 1] === "*";
  }

  function opensAppAndroid(href: string): boolean {
    const url = new URL(href);
    return filters.some((f) =>
      f.data.some((d) => d.scheme === url.protocol.slice(0, -1) && d.host === url.hostname && !!d.pathPattern && androidGlob(d.pathPattern, url.pathname)),
    );
  }

  it("her filtre dogrulanir ve yalniz https://bagajpark.com tasir", () => {
    for (const f of filters) {
      expect(f.autoVerify).toBe(true);
      for (const d of f.data) expect([d.scheme, d.host]).toEqual(["https", "bagajpark.com"]);
    }
  });

  it.each([
    ["/tr/shop/cmabc123", true],
    ["/tr/bookings/0f8fad5b-d9cb-469f-a165-70867728950e", true],
    ["/de/partner/bookings/0f8fad5b-d9cb-469f-a165-70867728950e", true],
    ["/tr/account/affiliate", true],
    ["/tr/register", false],
    ["/tr/register?ref=ABCD2345", false],
    ["/tr/bookings/lookup", false],
    ["/tr/bookings/manage/eyJhbGciOi", false],
    ["/tr/bookings/manage/0f8fad5b-d9cb-469f-a165-70867728950e", false],
    ["/tr/bookings/0f8fad5b-d9cb-469f-a165-70867728950e/dispute", false],
    ["/tr/bookings", false],
    ["/tr/admin/bookings/0f8fad5b-d9cb-469f-a165-70867728950e", false],
    ["/tr/auth/new-password?token=x", false],
    ["/tr/account", false],
    ["/app", false],
  ])("%s -> uygulama: %s", (path, expected) => {
    expect(opensAppAndroid(`https://bagajpark.com${path}`)).toBe(expected);
  });

  it("Android'in actigi her yol iOS'ta da uygulamada acilir", () => {
    for (const p of ["/tr/shop/x", "/tr/bookings/0f8fad5b-d9cb-469f-a165-70867728950e", "/en/partner/bookings/0f8fad5b-d9cb-469f-a165-70867728950e", "/tr/account/affiliate"]) {
      expect(APP_LINK_PATHS.some((g) => new RegExp(`^${g.replace(/\*/g, ".*")}$`).test(p))).toBe(true);
    }
  });
});
