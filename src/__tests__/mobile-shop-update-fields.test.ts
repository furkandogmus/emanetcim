import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { stripComments } from "./helpers/strip-comments";
import { readSourceTree } from "./helpers/source-snapshot";

/**
 * ISTEMCININ GONDERDIGI ALAN SUNUCUDA YOKSA SESSIZCE ATILIR.
 *
 * `z.object` tanimlanmamis alanlari varsayilan olarak DUSURUR: gonderen taraf
 * 200 alir, degeri kaydedilmez, hicbir yerde uyari kalmaz. Ayni gun iki ornegi
 * bulundu:
 *
 *   - `/checkout/intent` -> `couponCode`: misafir kupon girer, TAM FIYAT oder.
 *   - `/partner/shop`    -> `address`, `city`, `district`: esnaf adresini
 *     duzeltir, "kaydedildi" yanitini alir ve hicbir sey degismez.
 *
 * Ikincisi ozellikle sinsi, cunku adres misafirin dukkani buldugu metin:
 * yanlis kalan bir adres misafiri yanlis kapiya gonderir. Web tarafi
 * (`actions/shop.ts`) uc alani da kabul ediyordu -- kural yine iki tasiyicidan
 * yalnizca birinde vardi.
 */

describe("partner/shop guncelleme alanlari", () => {
  const uc = stripComments(
    readFileSync(join(process.cwd(), "src/app/api/mobile/partner/shop/route.ts"), "utf-8"),
  );

  it.each(["address", "city", "district"])("`%s` semada tanimli", (alan) => {
    expect(uc).toMatch(new RegExp(`${alan}:\\s*z\\.string\\(\\)`));
  });

  it.each(["address", "city", "district"])("`%s` gercekten YAZILIYOR", (alan) => {
    // Semaya eklemek yetmez: `data` nesnesine de gecmeli.
    expect(uc).toMatch(new RegExp(`data\\.${alan} = parsed\\.data\\.${alan}`));
  });

  it("web ile ayni alan kumesi", () => {
    const web = stripComments(
      readFileSync(join(process.cwd(), "src/actions/shop.ts"), "utf-8"),
    );
    for (const alan of ["address", "city", "district"]) {
      expect(web, `web ${alan} kabul ediyor`).toContain(`${alan}:`);
    }
  });
});

/**
 * SINIF TARAMASI: mobil istemcinin `body: { ... }` ile GONDERDIGI her alanin
 * hedef ucta bir karsiligi olmali. Istemci Expo (`mobile-expo/src`); Flutter
 * kaldirildi (2026-10-18), tarama onunla birlikte Expo'ya tasindi.
 *
 * Kardesi `partner-shop-phone.test.ts`te: o OKUMA yonunu tariyor, bu YAZMA yonunu.
 */
describe("mobil istemcinin gonderdigi alanlar sunucuda taniniyor", () => {
  const KOK = join(process.cwd(), "src/app/api/mobile");

  /**
   * `/admin/reviews/${id}/${action}` -> `admin/reviews/[id]/[action]/route.ts`. `${...}`
   * iceren her parca o klasordeki HERHANGI bir `[...]` klasore eslenir; yalnizca `[id]`
   * denenirse `[imageId]`, `[action]` gibi uclar sessizce taranmadan kalir.
   */
  function ucDosyasi(uc: string): string | null {
    let dir = KOK;
    for (const parca of uc.replace(/^\//, "").split("/")) {
      if (!parca) continue;
      if (parca.includes("${")) {
        let dinamik: string | undefined;
        try {
          dinamik = readdirSync(dir).find((d) => /^\[.+\]$/.test(d));
        } catch {
          return null;
        }
        if (!dinamik) return null;
        dir = join(dir, dinamik);
      } else dir = join(dir, parca);
    }
    const aday = join(dir, "route.ts");
    try {
      return statSync(aday).isFile() ? aday : null;
    } catch {
      return null;
    }
  }

  /** Uc kaynagi + paylasilan govde semasi (`@/lib/*-input`; web action'i ve mobil uclar ortak). */
  function ucKaynagi(hedef: string): string {
    const ham = readFileSync(hedef, "utf-8");
    const semalar = [...ham.matchAll(/from\s+"@\/lib\/([\w-]+-input)"/g)].map((s) =>
      readFileSync(join(process.cwd(), "src/lib", `${s[1]}.ts`), "utf-8"),
    );
    return stripComments([ham, ...semalar].join("\n"));
  }

  const alanlarOf = (govde: string) =>
    govde
      .split(",")
      .map((x) => x.trim())
      .filter((x) => x && !x.startsWith("..."))
      .map((x) => x.split(":")[0].trim());

  const GOVDE = String.raw`,\s*\{\s*method:\s*"(?:POST|PUT|PATCH)",\s*body:\s*\{([^}]*)\}`;
  // api<T>("/uc", { method: "POST", body: { a, b: x } }) -- `withShop(...)` sarmali da olur.
  const DOGRUDAN = new RegExp(
    String.raw`api(?:<[^>]*>)?\(\s*(?:withShop\(\s*)?["${"`"}]([^"${"`"}?]+)[^,]*(?:,\s*[a-zA-Z]+\))?` + GOVDE,
    "g",
  );
  /*
    Paylasilan bilesen (esnaf + yonetici): `api(url("/alt"), ...)`. Uc adresi bilesenin
    CIZILDIGI yerde duz metin `basePath` olarak durur; tabanlar oradan okunur, yani
    yeni bir kullanim eklendiginde o uc da kendiliginden taranir.
  */
  const PAYLASILAN = new RegExp(String.raw`api(?:<[^>]*>)?\(\s*url\(\s*(?:["${"`"}]([^"${"`"}]*)["${"`"}])?[^,]*` + GOVDE, "g");

  function tabanlar(bilesen: string, kaynaklar: Map<string, string>): string[] {
    const re = new RegExp(String.raw`<${bilesen}\b[^>]*?basePath=(?:"([^"]+)"|\{${"`"}([^${"`"}]+)${"`"}\})`, "g");
    const out = new Set<string>();
    for (const src of kaynaklar.values()) for (const m of src.matchAll(re)) out.add(m[1] ?? m[2]);
    return [...out];
  }

  type Cagri = { uc: string; alanlar: string[]; dosya: string };

  function cagrilar(): Cagri[] {
    const kaynaklar = new Map(
      readSourceTree("mobile-expo/src", { skipDirs: ["__tests__"] }).map((f) => [f.path, f.text] as const),
    );
    const out: Cagri[] = [];
    for (const [f, src] of kaynaklar) {
      for (const m of src.matchAll(DOGRUDAN)) out.push({ uc: m[1], alanlar: alanlarOf(m[2]), dosya: f });
      const bilesenler = [...src.matchAll(/export function (\w+)\(\{[^)]*?\bbasePath\b/g)].map((m) => m[1]);
      if (bilesenler.length === 0) continue;
      const bazlar = bilesenler.flatMap((b) => tabanlar(b, kaynaklar));
      for (const m of src.matchAll(PAYLASILAN)) {
        // `url("closureId=...")` sorgu dizesidir, alt yol degil.
        const alt = m[1]?.startsWith("/") ? m[1] : "";
        for (const baz of bazlar) out.push({ uc: `${baz}${alt}`, alanlar: alanlarOf(m[2]), dosya: f });
      }
    }
    return out;
  }

  // Iki test ayni taramayi kullanir; bir kez kurulur.
  let tarananOnbellek: Array<Cagri & { hedef: string }> | null = null;
  const taranan = () =>
    (tarananOnbellek ??= cagrilar()
      .map((c) => ({ ...c, hedef: ucDosyasi(c.uc) }))
      .filter((c): c is Cagri & { hedef: string } => c.hedef !== null));

  it("gonderilen her alan hedef ucta geciyor", () => {
    const ihlaller: string[] = [];
    const liste = taranan();
    for (const c of liste) {
      const ucSrc = ucKaynagi(c.hedef);
      for (const a of new Set(c.alanlar)) {
        // KELIME SINIRI SART: duz `includes` `city`yi `capacity` icinde bulurdu.
        if (!new RegExp(`\\b${a}\\b`).test(ucSrc)) ihlaller.push(`${c.uc} -> ${a}`);
      }
    }

    // 2026-11-23 olcumu: 25 cagri (paylasilan saat formu ve moderasyon dahil). Dusus, taramanin bir cagri bicimini kaybettigi demek.
    expect(liste.length, "eslesen uc sayisi dustu -- tarama bir cagri bicimini goremiyor").toBeGreaterThanOrEqual(25);
    expect(
      ihlaller,
      `istemci bu alanlari gonderiyor ama uc tanimiyor (zod sessizce atar):\n${ihlaller.join("\n")}`,
    ).toEqual([]);
  });

  it("paylasilan saat formu ve moderasyon uclari ADIYLA taraniyor", () => {
    const route = (p: string) => join(KOK, p, "route.ts");
    const hedefler = new Set(taranan().map((c) => c.hedef));
    for (const p of [
      "partner/shop/schedule",
      "admin/shops/[id]/schedule",
      "admin/reviews/[id]/[action]",
    ]) {
      expect(hedefler, `${p} taranmiyor`).toContain(route(p));
    }
  });
});

/**
 * Saat formunun govdesi ile sunucu semasi BIREBIR: taramanin kelime aramasi bir alanin
 * eksik ya da fazla oldugunu yakalar, bu test ikisini de. Esnaf ve yonetici uclari ayni
 * semayi (`lib/shop-schedule-input.ts`) kullaniyor olmali.
 */
describe("ScheduleEditor govdesi = shop-schedule-input semasi", () => {
  const editor = stripComments(
    readFileSync(join(process.cwd(), "mobile-expo/src/components/ScheduleEditor.tsx"), "utf-8"),
  );
  const govde = (method: string) => {
    const m = editor.match(new RegExp(String.raw`method:\s*"${method}",\s*body:\s*\{([^}]*)\}`));
    expect(m, `${method} govdesi bulunamadi`).not.toBeNull();
    return m![1]
      .split(",")
      .map((x) => x.trim().split(":")[0].trim())
      .filter(Boolean)
      .sort();
  };

  it("POST (izin) anahtarlari closureInputSchema ile ayni", async () => {
    const { closureInputSchema } = await import("@/lib/shop-schedule-input");
    expect(govde("POST")).toEqual(Object.keys(closureInputSchema.shape).sort());
  });

  it("PUT (haftalik saat) anahtarlari weeklyHoursSchema ile ayni", async () => {
    const { weeklyHoursSchema } = await import("@/lib/shop-schedule-input");
    expect(govde("PUT")).toEqual(Object.keys(weeklyHoursSchema.shape).sort());
  });

  it.each(["partner/shop/schedule", "admin/shops/[id]/schedule"])("%s ayni semayla dogruluyor", (p) => {
    const src = stripComments(readFileSync(join(process.cwd(), "src/app/api/mobile", p, "route.ts"), "utf-8"));
    expect(src).toMatch(/closureInputSchema\.safeParse/);
    expect(src).toMatch(/weeklyHoursSchema\.safeParse/);
  });
});
