import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import fs from "node:fs";
import path from "node:path";

/**
 * SITENIN KOK ADRESI TEK YERDEN COZULUR.
 *
 * NEDEN VAR (2026-08-31'de olculdu): ayni kavram on yerde ayri ayri
 * cozuluyordu ve DORT FARKLI yedek degeri vardi:
 *
 *   `site-urls.ts`          BASE || APP || "http://localhost:3000"
 *   `config.ts`             BASE || "http://localhost:3000"     (APP'i yok sayar)
 *   `mail.ts`               APP  || "http://localhost:3000"     (BASE'i yok sayar)
 *   `NotificationService`   APP  || "https://bagajpark.com"     (x6)
 *   `ShopService`           APP  || "https://bagajpark.com"
 *
 * Iki somut ariza:
 *
 * 1. **Sifre sifirlama ve dogrulama e-postalari `localhost` isaret edebiliyordu.**
 *    `NEXT_PUBLIC_BASE_URL` tanimli, `NEXT_PUBLIC_APP_URL` tanimsizsa -- ki
 *    `docker-compose.env.example` tam olarak bu ayrimi oneriyor -- canonical ve
 *    sitemap dogru cikiyor ama `mail.ts` `localhost`a dusuyordu. Kullanici
 *    parolasini SIFIRLAYAMAZ hale gelir ve bunun sebebini goremez.
 * 2. **Yedek deger olarak URETIM alan adi sabitlenmisti** (yedi yerde). Bir
 *    hazirlik ortaminda degisken tanimsiz kalirsa test kullanicilarina sessizce
 *    uretim baglantilari giden e-postalar cikiyordu.
 */

const ROOT = path.resolve(__dirname, "../..");
const HELPER = "src/lib/site-base-url.ts";

function stripComments(src: string): string {
  return src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
}

function walk(dir: string, out: string[] = []): string[] {
  if (!fs.existsSync(dir)) return out;
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) {
      if (e.name === "__tests__") continue;
      walk(p, out);
    } else if (/\.tsx?$/.test(e.name)) {
      out.push(p);
    }
  }
  return out;
}

describe("kok adres tek yerden cozulur", () => {
  it("yardimci disinda hicbir dosya kok adres degiskenini okumuyor", () => {
    const offenders: string[] = [];
    for (const file of walk(path.join(ROOT, "src"))) {
      const rel = path.relative(ROOT, file);
      if (rel === HELPER) continue;
      const src = stripComments(fs.readFileSync(file, "utf8"));
      for (const m of src.matchAll(
        /process\.env\.NEXT_PUBLIC_(?:BASE|APP)_URL/g,
      )) {
        offenders.push(`${rel}: ${m[0]}`);
      }
    }
    expect(
      offenders,
      `Kok adres ${HELPER} disinda cozuluyor. Her kopya kendi yedegini ` +
        `getiriyor ve sonuc taşiyiciya gore degisiyor: canonical dogru ` +
        `cikarken sifre sifirlama e-postasi \`localhost\` isaret edebiliyordu. ` +
        `\`getSiteBaseUrl()\` kullanin:\n` + offenders.join("\n"),
    ).toEqual([]);
  });

  it("hicbir yerde URETIM alan adi yedek deger olarak SABITLENMIYOR", () => {
    /*
      Yedek olarak `https://bagajpark.com` yazmak, degisken tanimsiz kalan bir
      hazirlik ortamindan test kullanicilarina URETIM baglantilari gonderir --
      ve hata hicbir yere yansimaz, cunku URL "dogru gorunur".
    */
    const offenders: string[] = [];
    for (const file of walk(path.join(ROOT, "src"))) {
      const src = stripComments(fs.readFileSync(file, "utf8"));
      for (const m of src.matchAll(/\|\|\s*['"]https:\/\/bagajpark\.com['"]/g)) {
        offenders.push(`${path.relative(ROOT, file)}: ${m[0].trim()}`);
      }
    }
    expect(offenders).toEqual([]);
  });
});

describe("getSiteBaseUrl davranisi", () => {
  const ORIGINAL = {
    base: process.env.NEXT_PUBLIC_BASE_URL,
    app: process.env.NEXT_PUBLIC_APP_URL,
    node: process.env.NODE_ENV,
  };

  beforeEach(() => {
    vi.resetModules();
    delete process.env.NEXT_PUBLIC_BASE_URL;
    delete process.env.NEXT_PUBLIC_APP_URL;
  });

  afterEach(() => {
    if (ORIGINAL.base === undefined) delete process.env.NEXT_PUBLIC_BASE_URL;
    else process.env.NEXT_PUBLIC_BASE_URL = ORIGINAL.base;
    if (ORIGINAL.app === undefined) delete process.env.NEXT_PUBLIC_APP_URL;
    else process.env.NEXT_PUBLIC_APP_URL = ORIGINAL.app;
    vi.resetModules();
  });

  it("YALNIZCA `NEXT_PUBLIC_BASE_URL` tanimliysa onu kullanir", async () => {
    /*
      Kirilan senaryo tam olarak buydu: `mail.ts` bu durumda `localhost`a
      dusuyordu, yani sifre sifirlama baglantilari calismiyordu.
    */
    process.env.NEXT_PUBLIC_BASE_URL = "https://bagajpark.com";
    const { getSiteBaseUrl } = await import("@/lib/site-base-url");
    expect(getSiteBaseUrl()).toBe("https://bagajpark.com");
  });

  it("YALNIZCA `NEXT_PUBLIC_APP_URL` tanimliysa onu kullanir", async () => {
    process.env.NEXT_PUBLIC_APP_URL = "https://ornek.test";
    const { getSiteBaseUrl } = await import("@/lib/site-base-url");
    expect(getSiteBaseUrl()).toBe("https://ornek.test");
  });

  it("ikisi de tanimliysa BASE oncelikli", async () => {
    process.env.NEXT_PUBLIC_BASE_URL = "https://bagajpark.com";
    process.env.NEXT_PUBLIC_APP_URL = "http://localhost";
    const { getSiteBaseUrl } = await import("@/lib/site-base-url");
    expect(getSiteBaseUrl()).toBe("https://bagajpark.com");
  });

  it("sondaki egik cizgi atilir", async () => {
    process.env.NEXT_PUBLIC_BASE_URL = "https://bagajpark.com/";
    const { getSiteBaseUrl } = await import("@/lib/site-base-url");
    expect(getSiteBaseUrl()).toBe("https://bagajpark.com");
  });

  it("hicbiri yoksa yapilandirilmamis sayilir", async () => {
    const { isSiteBaseUrlConfigured, getSiteBaseUrl } = await import(
      "@/lib/site-base-url"
    );
    expect(isSiteBaseUrlConfigured()).toBe(false);
    expect(getSiteBaseUrl()).toBe("http://localhost:3000");
  });
});
