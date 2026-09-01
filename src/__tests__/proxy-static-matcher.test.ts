import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";

/**
 * ARA KATMAN STATIK DOSYAYA DOKUNMAZ.
 *
 * NEDEN VAR (2026-09-01): `src/proxy.ts` matcher'i statik yollari tek tek
 * sayiyordu ve liste dort yerde eksikti. Sayilmayan yol i18n yonlendirmesine
 * yakalaniyor, `/images/blog/x.webp` istegi `/tr/images/blog/x.webp`e 307
 * doniyordu.
 *
 * Disaridan gorunmuyordu: nginx `/images/*`i Next'e hic ugratmiyor. Ama
 * `next/image` yerel dosyayi kendi icinden cekiyor, 307'ye takiliyor ve 400
 * ("The requested resource isn't a valid image") doniyordu -- blog listesindeki
 * butun kapaklar kirikti. `og-image.png` (paylasim kartlari) ve `push-sw.js`
 * (web push worker kaydi) da ayni sekilde kiriktı.
 *
 * Hicbir test matcher'i tutmadigi icin dordu de sessizce yayina cikti. Bu dosya
 * o bosluk.
 */

/*
  `src/proxy.ts` METIN OLARAK okunuyor, import EDILMIYOR: modul next-intl'in
  middleware'ini de yukluyor ve o test ortaminda cozulmuyor
  ("Cannot find module 'next/server'"). Mandal testinin amaci zaten calisma
  zamani davranisi degil, dosyada yazan desen.
*/
function readMatcherPatterns(): string[] {
  const source = fs.readFileSync(
    path.join(process.cwd(), "src/proxy.ts"),
    "utf8",
  );
  const block = source.match(/matcher:\s*\[([\s\S]*?)\]/);
  if (!block) throw new Error("src/proxy.ts icinde matcher dizisi bulunamadi");
  return [...block[1].matchAll(/'([^']+)'/g)].map((m) =>
    /*
      Dosyadan METIN geldigi icin JS string kacislari cozulmemis durumda:
      kaynakta `\\.` yazan sey calisma zamaninda `\.` olur. Cozmeden RegExp'e
      verirsek `\\.` "ters bolu + herhangi bir karakter" diye okunur ve
      lookahead sessizce bozulur -- test yesil kalirken matcher kirik olabilir.
    */
    m[1].replace(/\\\\/g, "\\"),
  );
}

/** `config.matcher`daki negatif-lookahead desenini gercek istek yoluna uygular. */
function middlewareRuns(pathname: string): boolean {
  const patterns = readMatcherPatterns();
  return patterns.some((pattern) => {
    const source = pattern
      // `:path*` Next'in kendi sozdizimi; regex karsiligi "gerisi ne olursa olsun".
      .replace(/\/:path\*/g, "(?:/.*)?")
      .replace(/\/$/, "/");
    return new RegExp(`^${source}$`).test(pathname);
  });
}

describe("proxy matcher statik dosyalari disliyor", () => {
  /*
    Uretimde 307 aldigi olculen dort yol. Buraya yeni bir statik dosya
    eklendiginde once bu listeye yazin.
  */
  const staticPaths = [
    "/images/blog/zurih-hauptbahnhof.webp",
    "/images/cities/ankara.jpg",
    "/og-image.png",
    "/push-sw.js",
    "/sw.js",
    "/manifest.json",
    "/favicon.ico",
    "/icons/icon-192x192.png",
    "/next.svg",
    "/_next/static/chunk.js",
    "/_next/image",
  ];

  it.each(staticPaths)("%s ara katmana girmez", (p) => {
    expect(middlewareRuns(p)).toBe(false);
  });

  /*
    Ters yon de onemli: matcher'i "her seyi disla" diye genisletmek hatayi
    kapatir ama i18n yonlendirmesini de oldurur. Uygulama rotalari GECMELI.
  */
  const appPaths = [
    "/",
    "/tr",
    "/tr/blog",
    "/tr/blog/mumbai-banliyo-treni-valizle-binilmez",
    "/en/blog/kyiv-luggage-storage-overnight-train-curfew",
    "/search",
    "/partner",
    "/admin/blog",
  ];

  it.each(appPaths)("%s ara katmana girer", (p) => {
    expect(middlewareRuns(p)).toBe(true);
  });
});
