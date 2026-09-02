import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";

/**
 * Her form girdisinin erişilebilir bir adı olmalı.
 *
 * NEDEN (2026-08-22 taraması): 23 girdi yalnızca `placeholder` ile
 * etiketlenmişti. Placeholder etiket yerine geçmez:
 *   - Kullanıcı yazmaya başlayınca **kaybolur**; çok alanlı bir formda (kayıt
 *     formu 5 alan) hangi alanda olduğu görünmez hâle gelir.
 *   - Ekran okuyucuların placeholder'ı ad olarak okuması **tutarsızdır** ve WCAG
 *     bunu açıkça önermez.
 *
 * `<label>` ile sarılmış girdiler DOĞRUDUR ve bu tarama onları saymaz — ilk
 * ölçümde 38 çıkmıştı, 15'i o kalıptı. Doğru sayı 23'tü.
 *
 * MİSAFİR YÜZEYİNDE TOLERANS YOK. Kalan borç yönetim panellerinde.
 */

/**
 * Misafirin gördüğü yollar. Buralarda etiketsiz girdi kabul edilmez —
 * dönüşüm yolu ve kimlik akışları burada.
 */
const GUEST_SURFACES = [
  "src/components/guest",
  "src/app/[locale]/login",
  "src/app/[locale]/register",
  "src/app/[locale]/auth",
  "src/app/[locale]/bookings",
  "src/app/[locale]/account",
];

/**
 * Yönetim/partner panellerindeki mevcut borç. Ölçüldü: 2026-08-22 (19),
 * 2026-09-02'de 17'ye indi.
 *
 * Bu sayı bir MANDAL: düşebilir, yükselemez. Borç kapatıldıkça düşürün.
 *
 * KALAN BORÇ ARTIK TAMAMEN ADMİN YÜZEYİNDE. 2026-09-02'de esnaf tarafındaki
 * iki girdi kapatıldı ve ikisi farklı sebeptendi:
 *
 *   - `PartnerSealsClient` (mühür talep adedi): hiç görsel etiketi yoktu,
 *     yalnızca placeholder — yazmaya başlayınca kaybolur ve alan adsız kalır.
 *   - `PartnerShopSettingsForm` (SMS telefonu): görsel etiket vardı ama
 *     `htmlFor`/`id` bağı yoktu; ekran okuyucu için etiketsizdi.
 *
 * Ayrım önemli, çünkü esnaf bu ekranları HER GÜN kullanıyor; admin paneli az
 * sayıda kişinin ara sıra açtığı bir yüzey. Borcun kalan kısmı oraya ait.
 */
const ADMIN_LABEL_DEBT_CEILING = 17;

function walk(dir: string, out: string[] = []): string[] {
  if (!fs.existsSync(dir)) return out;
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p, out);
    else if (e.name.endsWith(".tsx")) out.push(p);
  }
  return out;
}

/** `<label>` ile sarılmış girdiler doğru etiketlidir; sayılmaz. */
function unlabelledInputs(file: string): number {
  const src = fs.readFileSync(file, "utf8");
  let count = 0;
  for (const m of src.matchAll(/<(input|textarea)\b[\s\S]{0,800}?\/>/g)) {
    const tag = m[0];
    if (tag.includes('type="hidden"') || tag.includes("aria-hidden")) continue;
    if (!tag.includes("placeholder")) continue;
    if (tag.includes("aria-label") || tag.includes("aria-labelledby")) continue;

    /*
      `htmlFor`/`id` BAGI DA GECERLI ETIKETTIR (2026-09-02'de eklendi).

      Test yalnizca `aria-label` ile sarmalayan `<label>`i taniyordu. Ama
      erisilebilirligin TERCIH EDILEN bicimi ucuncu bir yol: gorunur bir
      `<label htmlFor="x">` ve `id="x"` tasiyan girdi. Bu, hem ekran okuyucuya
      ad verir hem etikete tiklaninca alana odaklanmayi saglar -- `aria-label`
      ikincisini yapmaz.

      Ilk yazilisinda bu yol sayilmadigi icin test, DOGRU duzeltmeyi ihlal
      olarak isaretliyordu: `PartnerShopSettingsForm`daki telefon alanina
      `htmlFor`/`id` bagi eklendi ve sayac dusmedi. Yani mandal, kendisini
      memnun etmek icin daha zayif bir cozume (`aria-label`) itiyordu.
    */
    const idMatch = tag.match(/\bid="([^"]+)"/);
    if (idMatch && src.includes(`htmlFor="${idMatch[1]}"`)) continue;

    const before = src.slice(Math.max(0, m.index! - 400), m.index!);
    const wrappedInLabel =
      (before.match(/<label/g)?.length ?? 0) >
      (before.match(/<\/label/g)?.length ?? 0);
    if (wrappedInLabel) continue;
    count += 1;
  }
  return count;
}

function collect(roots: string[]): Array<{ file: string; count: number }> {
  const out: Array<{ file: string; count: number }> = [];
  for (const root of roots) {
    for (const file of walk(path.join(process.cwd(), root))) {
      const n = unlabelledInputs(file);
      if (n > 0) out.push({ file: path.relative(process.cwd(), file), count: n });
    }
  }
  return out;
}

describe("form girdilerinin erişilebilir adı", () => {
  it("MİSAFİR yüzeyinde etiketsiz girdi yok", () => {
    const offenders = collect(GUEST_SURFACES);
    expect(
      offenders,
      `Bu misafir yüzeylerinde yalnızca placeholder ile etiketlenmiş girdi var.\n` +
        `Placeholder yazmaya başlayınca kaybolur ve ekran okuyucu desteği tutarsızdır.\n` +
        `\`aria-label\` ekleyin veya girdiyi \`<label>\` ile sarın:\n` +
        offenders.map((o) => `  ${o.count}× ${o.file}`).join("\n"),
    ).toEqual([]);
  });

  it(`yönetim panellerindeki borç ${ADMIN_LABEL_DEBT_CEILING}'u geçmiyor (mandal)`, () => {
    const offenders = collect(["src/components/admin", "src/components/partner"]);
    const total = offenders.reduce((s, o) => s + o.count, 0);
    expect(
      total,
      `Etiketsiz girdi sayısı ${total}, tavan ${ADMIN_LABEL_DEBT_CEILING}.\n` +
        offenders.map((o) => `  ${o.count}× ${o.file}`).join("\n"),
    ).toBeLessThanOrEqual(ADMIN_LABEL_DEBT_CEILING);
  });
});
