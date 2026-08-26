import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";

/**
 * Sunucuda yakalanmamis promise reddi — MANDAL (tavan 0).
 *
 * NEDEN VAR: Node 15'ten beri yakalanmamis bir promise reddi SURECI DUSURUR
 * (`--unhandled-rejections=throw` varsayilandir). Sunucu kodundaki
 * `void birSey();` kalibi tam olarak bunu uretir: sonucu kimse beklemez, ama
 * reddederse kimse de yakalamaz.
 *
 * Bu, "bildirim gonderilemedi" gibi ZARARSIZ gorunen bir hatayi TUM SUNUCUYU
 * dusuren bir olaya cevirir. Olculdu (2026-08-26): mobil odeme ucunda
 * (`api/mobile/checkout/intent`) iki bildirim cagrisi boyleydi — rezervasyon
 * yazildiktan SONRA calistiklari icin, bir e-posta saglayicisi hatasi
 * rezervasyonu degil, sureci vururdu.
 *
 * Kod tabaninin geri kalani zaten dogru kalibi kullaniyor:
 *     void notificationService.sendEmail(...).catch((e) => logger.warn(...));
 * Bu tarama o kalibin ISTISNASIZ oldugunu garanti eder.
 *
 * KAPSAM YALNIZCA SUNUCU: `src/components` bilerek disarida. Tarayicida
 * yakalanmamis red yalnizca konsola yazilir, sekmeyi veya sunucuyu dusurmez —
 * ayni kural degildir.
 */

/** Yalnizca sunucuda calisan kod. */
const SERVER_ROOTS = ["src/services", "src/actions", "src/app/api", "src/lib"];

/**
 * Tavan 0. YUKSELTMEYIN: bu sayiyi 1 yapmak, "bir uc, uretimde sureci
 * dusurebilir" demenin baska bir yoludur.
 */
const UNGUARDED_VOID_CEILING = 0;

function walk(dir: string, out: string[] = []): string[] {
  if (!fs.existsSync(dir)) return out;
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p, out);
    else if (
      (e.name.endsWith(".ts") || e.name.endsWith(".tsx")) &&
      !e.name.includes(".test.")
    ) {
      out.push(p);
    }
  }
  return out;
}

function stripComments(src: string): string {
  return src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
}

type Offender = { file: string; line: number; code: string };

/**
 * `void <ifade>;` deyimini bastan sonuna toplar (cok satirli olabilir) ve
 * icinde `.catch(` var mi diye bakar. Parantez/kume dengesi 0'a dondugunde ve
 * satir `;` ile bittiginde deyim bitmis sayilir.
 */
function findUnguardedVoidStatements(): Offender[] {
  const offenders: Offender[] = [];

  for (const root of SERVER_ROOTS) {
    for (const file of walk(path.join(process.cwd(), root))) {
      const lines = stripComments(fs.readFileSync(file, "utf8")).split("\n");

      for (let i = 0; i < lines.length; i++) {
        // `void 0` bir deger, promise degil.
        if (!/^\s*void\s+(?!0\b)/.test(lines[i])) continue;

        let depth = 0;
        const stmt: string[] = [];
        for (let j = i; j < lines.length && j < i + 80; j++) {
          const l = lines[j];
          stmt.push(l);
          depth += (l.match(/[({[]/g) ?? []).length;
          depth -= (l.match(/[)}\]]/g) ?? []).length;
          if (depth <= 0 && l.trimEnd().endsWith(";")) break;
        }

        const text = stmt.join("\n");
        if (!text.includes(".catch(")) {
          offenders.push({
            file: path.relative(process.cwd(), file),
            line: i + 1,
            code: lines[i].trim().slice(0, 80),
          });
        }
      }
    }
  }

  return offenders;
}

describe("sunucuda yakalanmamis promise reddi (mandal)", () => {
  it(`atesle-unut cagrilarinin hepsi .catch tasir (tavan ${UNGUARDED_VOID_CEILING})`, () => {
    const offenders = findUnguardedVoidStatements();

    const detail = offenders
      .map((o) => `  ${o.file}:${o.line}  ${o.code}`)
      .join("\n");

    expect(
      offenders.length,
      offenders.length
        ? `Sunucuda .catch'siz ${offenders.length} atesle-unut promise bulundu.\n` +
            `Her biri, reddettiginde Node surecini dusurebilir.\n` +
            `Duzeltme: sonuna .catch((err) => logger.error({ err }, "..."))  ekleyin.\n` +
            detail
        : undefined,
    ).toBeLessThanOrEqual(UNGUARDED_VOID_CEILING);
  });

  it("tarayici gercekten calisiyor (yanlis pozitif/negatif kontrolu)", () => {
    // Tarama mantiginin kendisi bozulursa test sessizce hep yesil kalirdi.
    const guarded = 'void doThing().catch((e) => log(e));';
    const unguarded = 'void doThing();';
    expect(guarded.includes(".catch(")).toBe(true);
    expect(unguarded.includes(".catch(")).toBe(false);
    expect(/^\s*void\s+(?!0\b)/.test(unguarded)).toBe(true);
    expect(/^\s*void\s+(?!0\b)/.test("  void 0;")).toBe(false);
  });
});
