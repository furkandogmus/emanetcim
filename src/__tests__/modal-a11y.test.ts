import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";

/**
 * Tam ekran katman çizen her bileşen modal sözleşmesini taşımalı.
 *
 * NEDEN (2026-08-22 taraması ve sonrası): `ConfirmDialog` erişilebilir hâle
 * getirildi ama kod tabanındaki modalların çoğu o bileşeni KULLANMIYOR — kendi
 * katmanını elle çiziyor. Dolayısıyla düzeltmenin tamamen dışında kaldılar:
 * 13 dosyada `fixed inset-0` katmanı vardı, 8'inde `role="dialog"` yoktu ve
 * hiçbiri Escape'i işlemiyordu. Klavye kullanıcısı için bunlar çıkışsız
 * katmanlardır.
 *
 * Bu tarama o kör noktayı kapatır: `ConfirmDialog`'u düzeltmek yeterli
 * değildi, çünkü sorun bileşende değil KALIPTAYDI.
 */

const ROOTS = ["src/components", "src/app"];

/**
 * Katman çizen ama modal OLMAYAN dosyalar. Her biri gerekçeli — bu liste
 * uzuyorsa muhtemelen gerçek bir modal muaf tutuluyordur.
 */
const NOT_MODALS = new Set([
  // Yönlendirme sırasındaki tam ekran yükleniyor göstergesi: odaklanılabilir
  // hiçbir öğesi yok, kullanıcı etkileşimi beklemiyor.
  "src/app/[locale]/loading.tsx",
  // Tek katmanı QR önizlemesi yüklenirken gösterilen `role="status"` spinner'ı;
  // modalların tamamı ayrı bileşenlere taşındı (CheckInDialog, CheckoutSealsDialog).
  "src/components/partner/PartnerClient.tsx",
]);

function walk(dir: string, out: string[] = []): string[] {
  if (!fs.existsSync(dir)) return out;
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p, out);
    else if (e.name.endsWith(".tsx")) out.push(p);
  }
  return out;
}

/** Yorum satırları sayılmaz — yalnızca gerçek kod. */
function stripComments(src: string): string {
  return src
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/^\s*\/\/.*$/gm, "");
}

type Offender = { file: string; reason: string };

function scan(): Offender[] {
  const offenders: Offender[] = [];

  for (const root of ROOTS) {
    for (const file of walk(path.join(process.cwd(), root))) {
      const rel = path.relative(process.cwd(), file);
      if (NOT_MODALS.has(rel)) continue;

      const src = stripComments(fs.readFileSync(file, "utf8"));
      if (!/className=["'`][^"'`]*fixed inset-0/.test(src)) continue;

      if (!/role=["']dialog["']/.test(src)) {
        offenders.push({ file: rel, reason: 'role="dialog" yok' });
        continue;
      }

      /**
       * Escape ya paylaşılan kancadan gelir ya da elle işlenir. Kancayı
       * kullanmak tercih edilendir: arka plan kaydırma kilidini ve odağın
       * geri verilmesini de birlikte getirir.
       */
      const handlesEscape =
        /useModalBehavior/.test(src) || /["']Escape["']/.test(src);
      if (!handlesEscape) {
        offenders.push({ file: rel, reason: "Escape ile kapanmıyor" });
      }
    }
  }

  return offenders;
}

describe("modal erişilebilirlik sözleşmesi", () => {
  it("tam ekran katman çizen her bileşen dialog rolü taşır ve Escape ile kapanır", () => {
    const offenders = scan();
    expect(
      offenders.map((o) => `${o.file} — ${o.reason}`),
      "Yeni modal `useModalBehavior` kancasını kullanmalı ve `role=\"dialog\"` " +
        "+ `aria-modal` taşımalı. Modal değilse NOT_MODALS listesine gerekçesiyle ekleyin.",
    ).toEqual([]);
  });

  it("tarama gerçekten dosya buluyor — sessizce boş geçmiyor", () => {
    // Boş bir tarama "her şey yolunda" gibi görünür; en az bir modal görülmeli.
    const seen = ROOTS.flatMap((r) => walk(path.join(process.cwd(), r))).filter(
      (f) => /className=["'`][^"'`]*fixed inset-0/.test(fs.readFileSync(f, "utf8")),
    );
    expect(seen.length).toBeGreaterThan(5);
  });
});
