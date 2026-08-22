import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";

/**
 * `{ success: false }` DÖNEN bir action'ın sonucu kontrol edilmeli.
 *
 * NEDEN (2026-08-22 taraması): üç yerde arayüz, BAŞARISIZ olmuş bir işlem için
 * "başarılı" diyordu:
 *
 *   blockIpAction                → "IP engellendi" (hiçbir şey engellenmemişti)
 *   resendVerificationEmailAction→ "gönderildi"    (mail gitmemişti)
 *   updateCampaignAction         → "güncellendi"   (değişiklik kaydedilmemişti)
 *
 * Sebep bir sözleşme uyuşmazlığı: bu action'lar başarısızlıkta **fırlatmıyor**,
 * `{ success: false }` dönüyor. Çağıranlar ise yalnızca `try/catch` yazmıştı —
 * fırlatmayan bir hata catch'e düşmez. En kötüsü `blockIpAction`'du: yönetici bir
 * güvenlik denetimini yapılmış sanıyordu.
 *
 * Bu test, `{success:false}` dönebilen her action'ın çağrıldığı yerde sonucun
 * gerçekten okunduğunu doğrular.
 */

const ACTIONS_DIR = path.join(process.cwd(), "src/actions");

/** Gövdesinde `success: false` geçen action adları. */
function actionsThatCanReturnFailure(): string[] {
  const names: string[] = [];
  for (const f of fs.readdirSync(ACTIONS_DIR).filter((x) => x.endsWith(".ts"))) {
    const src = fs.readFileSync(path.join(ACTIONS_DIR, f), "utf8");
    for (const m of src.matchAll(/export async function (\w+)\(/g)) {
      const start = m.index! + m[0].length;
      /**
       * Gövde, bir sonraki TOP-LEVEL `export`'a kadar. İlk sürüm yalnızca
       * `export async function` arıyordu ve araya giren bir `type`/`const`
       * bildirimine TAŞIYORDU: `approveShopAction`, kendisinden sonra gelen bir
       * tipin `| { success: false; ... }` satırı yüzünden yanlışlıkla
       * "başarısız olabilir" sayılıyordu. Yanlış pozitif üreten bir mandal
       * bastırılır ve işe yaramaz hâle gelir.
       */
      const rest = src.slice(start);
      const nextExport = rest.search(/\nexport (async function|function|type|const|interface)\b/);
      const body = nextExport > 0 ? rest.slice(0, nextExport) : rest;
      if (/success:\s*false/.test(body)) names.push(m[1]);
    }
  }
  return names;
}

function walk(dir: string, out: string[] = []): string[] {
  if (!fs.existsSync(dir)) return out;
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p, out);
    else if (e.name.endsWith(".tsx")) out.push(p);
  }
  return out;
}

function stripComments(src: string): string {
  return src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
}

describe("başarısız olabilen action'ların sonucu okunuyor", () => {
  const failable = actionsThatCanReturnFailure();

  it("tarama gerçekten action buluyor — kural boşa çalışmasın", () => {
    // Regex bozulursa liste bosalir ve test sessizce her seyi onaylar.
    expect(failable.length).toBeGreaterThan(3);
  });

  it("hiçbir bileşen sonucu YOK SAYARAK başarı bildirmiyor", () => {
    const offenders: string[] = [];

    for (const root of ["src/components", "src/app"]) {
      for (const file of walk(path.join(process.cwd(), root))) {
        const src = stripComments(fs.readFileSync(file, "utf8"));
        for (const action of failable) {
          // `await fooAction(` cagrisi var mi, ve sonucu bir degiskene aliniyor mu?
          const callRe = new RegExp(
            `(const\\s+\\w+\\s*=\\s*await\\s+${action}\\()|(\\bawait\\s+${action}\\()`,
            "g",
          );
          for (const m of src.matchAll(callRe)) {
            const assigned = Boolean(m[1]);
            if (!assigned) {
              offenders.push(
                `${path.relative(process.cwd(), file)} → ${action}`,
              );
            }
          }
        }
      }
    }

    expect(
      offenders,
      `Bu çağrılar sonucu YOK SAYIYOR. İlgili action başarısızlıkta fırlatmaz,\n` +
        `\`{ success: false }\` döner — yani \`try/catch\` yetmez ve arayüz\n` +
        `başarısız bir işlem için "başarılı" der:\n` +
        offenders.map((o) => `  ${o}`).join("\n"),
    ).toEqual([]);
  });
});
