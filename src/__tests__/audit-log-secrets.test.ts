import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";

/**
 * DENETIM KAYDINA VE LOG'A SIR YAZILMAZ.
 *
 * NEDEN VAR (2026-08-31'de olculdu): `adminInitiatePartnerPasswordResetAction`
 * su satiri yaziyordu:
 *
 *     metadata: { phone: normalized, tokenId: row.token }
 *
 * Alan adi `tokenId` oldugu icin bir TANIMLAYICI gibi gorunuyordu. Degilti:
 * `row.token`, sifirlama bagindaki SIRRIN TA KENDISI -- onu bilen, o hesabin
 * parolasini degistirir. Isimlendirme, bu satirin gozden kacmasinin sebebi.
 *
 * Nereye gidiyordu: `AuditLog.metadata` sutununa, KALICI olarak. Ve
 * `/admin/audit-log` sayfasi metadata'yi `JSON.stringify` ile EKRANA BASIYOR --
 * yani her yonetici, baslatilmis her sifirlamanin calisir durumdaki bagini
 * okuyabiliyordu. Veritabani yedekleri ve log tasiyicilar da ayni degeri
 * tasiyor. Esnaf hesaplari e-postasiz kaydoldugu icin bu akis onlarin TEK
 * sifirlama yolu, yani nadir de kullanilmiyor.
 *
 * `rules/observability`: sir, token, PII log'a yazilmaz.
 */

const ROOT = path.resolve(__dirname, "../..");

/**
 * Bir SIR degeri tasiyan ifadeler. `tokenVersion` gibi sayaclar ve
 * `tokenFingerprint` gibi geri donusu olmayan ozetler kapsam disi.
 */
const SECRET_VALUE_RE =
  /\b(?:row|token|vt|reset|verification)\.token\b|\bpasswordHash\b|\bsecret\b\s*[,}]/;

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

/**
 * `writeAuditLog({...})` ve `logger.x({...})` cagrilarinin ILK nesne argumani.
 *
 * Suslu parantez sayarak gercek sinir bulunuyor. Ilk hali sabit uzunlukta bir
 * pencere aliyordu (cagridan sonraki 400 karakter) ve IKI HATALI POZITIF
 * uretti: `logger.error`dan birkac satir SONRA gelen `const passwordHash = ...`
 * ile duzeltmenin kendisi. Sabit pencere, kapsamı olmayan bir tarayicidir --
 * ve yanlis alarm ureten bir mandal bir sure sonra gevsetilir.
 */
function payloadBlocks(src: string): string[] {
  const out: string[] = [];
  const re = /(?:writeAuditLog|logger\.(?:info|warn|error|debug|fatal|trace))\s*\(\s*\{/g;
  for (const m of src.matchAll(re)) {
    let depth = 1;
    let i = m.index! + m[0].length;
    while (i < src.length && depth > 0) {
      if (src[i] === "{") depth++;
      else if (src[i] === "}") depth--;
      i++;
    }
    out.push(src.slice(m.index! + m[0].length, i));
  }
  return out;
}

/**
 * Kabul edilen cozum: degeri geri donusu OLMAYAN bir ozete cevirmek.
 * `tokenFingerprint(row.token)` ham token'i yazmaz, sha256 onekini yazar.
 */
const HASHED_RE = /(?:Fingerprint|fingerprint|createHash|sha256)\s*\(/;

describe("denetim kaydi ve log sir tasimiyor", () => {
  it("hicbir `writeAuditLog` / `logger.*` cagrisi token ya da hash degeri yazmiyor", () => {
    const offenders: string[] = [];
    for (const file of walk(path.join(ROOT, "src"))) {
      const src = stripComments(fs.readFileSync(file, "utf8"));
      for (const block of payloadBlocks(src)) {
        for (const line of block.split("\n")) {
          if (!SECRET_VALUE_RE.test(line)) continue;
          if (HASHED_RE.test(line)) continue;
          offenders.push(`${path.relative(ROOT, file)}: ${line.trim()}`);
        }
      }
    }
    expect(
      offenders,
      "Log ya da denetim kaydina SIR yaziliyor. Bu degerler kalici bir " +
        "sutuna, yedeklere ve log tasiyicilara gider; `/admin/audit-log` " +
        "sayfasi metadata'yi ekrana da basiyor. Geri donusu olmayan bir " +
        "parmak izi (sha256 oneki) yazin:\n" + offenders.join("\n"),
    ).toEqual([]);
  });

  it("esnaf sifirlama akisi token yerine parmak izi yaziyor", () => {
    const src = fs.readFileSync(
      path.join(ROOT, "src/actions/partner-password-reset.ts"),
      "utf8",
    );
    expect(src).toMatch(/tokenFingerprint/);
    expect(stripComments(src)).not.toMatch(/tokenId:\s*row\.token/);
  });
});
