import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { clientIpFromHeaders } from "@/lib/client-ip";

/**
 * ISTEMCI IP'SI TEK YERDEN OKUNUR — ve ILK `X-Forwarded-For` GIRDISI OKUNMAZ.
 *
 * NEDEN VAR (2026-08-31'de olculdu): on bes dosya IP'yi kendisi cikariyordu ve
 * HEPSI ayni sekilde yanlis yapiyordu -- `x-forwarded-for` basliginin ILK
 * girdisi. O girdi, istemcinin GONDERDIGI degerdir.
 *
 * `nginx/conf.d/default.conf`:
 *
 *     proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;   # EKLER
 *     proxy_set_header X-Real-IP       $remote_addr;                 # EZER
 *
 * `$proxy_add_x_forwarded_for` ekler: istemci `X-Forwarded-For: 9.9.9.9`
 * gonderdiginde uygulamaya `9.9.9.9, <gercek>` ulasir ve `[0]` saldirganin
 * yazdigini dondurur.
 *
 * SONUCU: uygulamadaki BUTUN IP hiz sinirlari, her istege rastgele bir baslik
 * eklenerek atlanabiliyordu -- giris (sifre serpmesi kovasi),
 * `bookings/lookup` (rezervasyon kodu kaba kuvveti, ki basarisi misafirin QR
 * token'ini ve iptal yetkisini veriyor), kayit, OTP, token yenileme, sifre
 * sifirlama, iletisim formu, `admin/setup`. Depo acik kaynak: bunu bulmak icin
 * iki dosya okumak yetiyor.
 *
 * `X-Real-IP` guvenilir, cunku `proxy_set_header` EZER: istemcinin gonderdigi
 * deger uygulamaya ulasmaz. `CF-Connecting-IP` ise DOGRUDAN OKUNMAZ -- nginx
 * onu ezmiyor, yani uydurulabilir.
 */

const ROOT = path.resolve(__dirname, "../..");
const HELPER = "src/lib/client-ip.ts";

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

describe("istemci IP'si guvenilir kaynaktan okunur", () => {
  it("yardimci disinda hicbir dosya IP basligini dogrudan okumuyor", () => {
    const offenders: string[] = [];
    for (const file of walk(path.join(ROOT, "src"))) {
      const rel = path.relative(ROOT, file);
      if (rel === HELPER) continue;
      const src = stripComments(fs.readFileSync(file, "utf8"));
      for (const m of src.matchAll(/["']x-(?:forwarded-for|real-ip)["']|["']cf-connecting-ip["']/gi)) {
        offenders.push(`${rel}: ${m[0]}`);
      }
    }
    expect(
      offenders,
      `IP basligi ${HELPER} disinda okunuyor. Her kopya ayni hatayi tekrar ` +
        `uretiyor: \`x-forwarded-for\`in ILK girdisi istemcinin yazdigidir ve ` +
        `nginx o basliga EKLER. \`clientIpFromHeaders\` / \`getClientIp\` ` +
        `kullanin:\n` + offenders.join("\n"),
    ).toEqual([]);
  });

  it("`X-Real-IP` tercih edilir, istemcinin XFF'i YOK SAYILIR", () => {
    /*
      Saldirgan senaryosu: `X-Forwarded-For: 9.9.9.9` gonderiyor, nginx gercek
      adresi SONA ekliyor ve `X-Real-IP`i kendi yaziyor.
    */
    const h = new Headers({
      "x-forwarded-for": "9.9.9.9, 203.0.113.7",
      "x-real-ip": "203.0.113.7",
    });
    expect(clientIpFromHeaders(h)).toBe("203.0.113.7");
  });

  it("`X-Real-IP` yoksa XFF'in SON girdisi alinir, ilki degil", () => {
    /*
      `$proxy_add_x_forwarded_for` gercek adresi SONA ekler. Ilk girdiyi almak,
      saldirganin yazdigi degeri almaktir.
    */
    const h = new Headers({ "x-forwarded-for": "9.9.9.9, 10.0.0.1, 203.0.113.7" });
    expect(clientIpFromHeaders(h)).toBe("203.0.113.7");
  });

  it("`CF-Connecting-IP` dogrudan okunmaz (nginx onu ezmiyor)", () => {
    const h = new Headers({
      "cf-connecting-ip": "9.9.9.9",
      "x-real-ip": "203.0.113.7",
    });
    expect(clientIpFromHeaders(h)).toBe("203.0.113.7");
  });

  it("hicbir baslik yoksa `unknown`", () => {
    expect(clientIpFromHeaders(new Headers())).toBe("unknown");
  });

  it("bos ve bosluklu girdiler atlanir", () => {
    const h = new Headers({ "x-forwarded-for": " , 203.0.113.7 ,  " });
    expect(clientIpFromHeaders(h)).toBe("203.0.113.7");
  });
});
