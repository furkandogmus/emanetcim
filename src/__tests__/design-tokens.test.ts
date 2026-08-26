import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";
import {
  SITE_IDENTITIES,
  resolveSiteIdentity,
  siteIdentityAttribute,
} from "@/lib/site-identity";

/**
 * GÖRSEL KİMLİK MANDALI — sabit stil sayısı düşebilir, yükselemez.
 *
 * NEDEN (2026-08-24'te ölçüldü): görsel dil ~1.900 yerde ELLE yazılmıştı:
 *
 *   orange-*         687
 *   font-black       615
 *   tracking-widest  284
 *   büyük rounded-*  155
 *   --brand-* token'ını kullanan dosya sayısı:  8
 *
 * Bunun sonucu bir zevk meselesi değil, MİMARİ bir kilit: "tasarımı
 * özgünleştirelim" demek 90+ dosyayı elle düzenlemek demekti, o yüzden hiç
 * yapılmadı. Ve tam da bu yüzden görünüm jenerikti — kimse global karar
 * veremeyince herkes Tailwind'in en az dirençli yolunu tekrarladı
 * (`font-black` + `rounded-3xl` + `orange-600`), yani her startup sitesinin
 * görüntüsü.
 *
 * `globals.css` içindeki kimlik katmanı kararı tek yere taşıdı. Bu mandal da
 * göçü yürütür: yeni bir bileşen sabit stil EKLEYEMEZ, `.id-*` sınıflarını
 * kullanmak zorundadır. Tavanlar borç kapandıkça DÜŞÜRÜLÜR.
 */

const ROOTS = ["src/components", "src/app"];

/**
 * Ölçülen değerler. Yalnızca AŞAĞI çekilir.
 *
 * 24 Ağustos göçü:
 *   tracking-widest  284 → 5     (280 dizi `.id-eyebrow`'a taşındı)
 *   font-black       615 → 380   (eyebrow dizilerindeki ağırlık kimliğe devredildi)
 *   rounded-büyük    155 → 105   (arbitrary değerler skalaya alındı)
 *   orange-*         687 → 686
 *
 * Kalan `font-black` ve `orange-*` sayıları YÜKSEK ama SORUN DEĞİL: ikisi de
 * kimliğe bağlı (`--font-weight-black`, `--color-orange-*`), yani kimliği takip
 * ediyorlar. Tavanlar yine de duruyor çünkü semantik bir sınıf (`.id-display`,
 * `.id-accent`) niyeti okunur kılar; `orange-600` bir rengin adıdır, "marka
 * vurgusu"nun değil.
 */
const CEILINGS = {
  accentColor: 686, // orange-50 … orange-900
  displayWeight: 380, // font-black
  eyebrowTracking: 5, // tracking-widest
  surfaceRadius: 105, // rounded-3xl / rounded-[2rem] / rounded-[2.5rem]
} as const;

function walk(dir: string, out: string[] = []): string[] {
  if (!fs.existsSync(dir)) return out;
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p, out);
    else if (e.name.endsWith(".tsx") && !e.name.includes(".test.")) out.push(p);
  }
  return out;
}

function countMatches(re: RegExp): { total: number; byFile: Array<[string, number]> } {
  const byFile: Array<[string, number]> = [];
  let total = 0;
  for (const root of ROOTS) {
    for (const file of walk(path.join(process.cwd(), root))) {
      const n = (fs.readFileSync(file, "utf8").match(re) ?? []).length;
      if (n > 0) {
        byFile.push([path.relative(process.cwd(), file), n]);
        total += n;
      }
    }
  }
  byFile.sort((a, b) => b[1] - a[1]);
  return { total, byFile };
}

function report(byFile: Array<[string, number]>): string {
  return byFile
    .slice(0, 8)
    .map(([f, n]) => `  ${String(n).padStart(4)}× ${f}`)
    .join("\n");
}

/**
 * ASIL GARANTİ BU BLOK.
 *
 * 1.658 sabit kullanımı tek tek `.id-*` sınıflarına çevirmek 114 dosyada elle
 * düzenleme demekti — hem riskli hem yarım kalmaya mahkûm. Bunun yerine
 * sınıfların KENDİSİ yeniden tanımlandı: Tailwind v4'te `orange-600`'ün ne
 * olduğu bir tema değişkenidir. O değişken kimlik katmanını gösterdiği sürece,
 * koddaki `text-orange-600` yazan 687 satır DEĞİŞMEDEN kimliği takip eder.
 *
 * Yani sabit sınıf artık bir KARAR değil, bir REFERANS. Bu bağlantı koparsa
 * jeneriklik sessizce geri gelir — o yüzden test ediliyor.
 */
describe("Tailwind yardımcıları kimliğe bağlı", () => {
  const css = fs.readFileSync("src/app/[locale]/globals.css", "utf8");

  it("marka rengi paleti kimlik skalasına bağlı — 10 adımın hepsi", () => {
    for (const step of [50, 100, 200, 300, 400, 500, 600, 700, 800, 900, 950]) {
      expect(
        css,
        `orange-${step} kimliğe bağlı değil — o adım Tailwind'in varsayılan ` +
          `turuncusuna sızar ve yön değiştirince yerinde kalır.`,
      ).toMatch(
        new RegExp(`--color-orange-${step}:\\s*var\\(--id-accent-${step}\\)`),
      );
    }
  });

  it("başlık ağırlığı ve etiket aralığı kimlikten geliyor", () => {
    expect(css).toMatch(/--font-weight-black:\s*var\(--id-display-weight\)/);
    expect(css).toMatch(/--tracking-widest:\s*var\(--id-eyebrow-tracking\)/);
  });

  it("yarıçap skalasının TAMAMI kimlikten geliyor", () => {
    // Yalnizca buyuk adimlar baglansaydi yon degistirince kartlarin kosesi
    // keskinlesir, icindeki 293 adet `rounded-2xl` kutu yuvarlak kalirdi --
    // yarim uygulanmis bir gorunum, ikisinden de kotu.
    const map: Array<[string, string]> = [
      ["--radius-lg", "--id-radius-sm"],
      ["--radius-xl", "--id-radius-md"],
      ["--radius-2xl", "--id-radius-lg"],
      ["--radius-3xl", "--id-radius-xl"],
      ["--radius-4xl", "--id-surface-radius"],
    ];
    for (const [tw, id] of map) {
      expect(css, `${tw} kimliğe bağlı değil`).toMatch(
        new RegExp(`${tw}:\\s*var\\(${id}\\)`),
      );
    }
    // `rounded-full` BILEREK baglanmadi: rozet her kimlikte rozettir.
    expect(css).not.toMatch(/--radius-full:\s*var\(--id-/);
  });

  it("nötr skalanın yüzey adımları kimlikten geliyor", () => {
    // `bg-gray-50` 213, `border-gray-100` 252 kullanim: kagit tonu ve sac teli
    // cizgisi bunlardan geliyor. Notr bir kimlik kararidir, miras degil.
    for (const step of [50, 100, 200, 300]) {
      expect(css, `gray-${step} kimliğe bağlı değil`).toMatch(
        new RegExp(`--color-gray-${step}:\\s*var\\(--id-neutral-${step}\\)`),
      );
    }
  });

  it("her yön TAM skala tanımlıyor — yarım skala sessiz sızıntıdır", () => {
    // Bir yon 500'u tanimlayip 600'u atlarsa, o adim varsayilan turuncuda kalir
    // ve sayfada iki farkli marka rengi yan yana gorunur.
    const blocks = [...css.matchAll(/\[data-identity="(\w+)"\]\s*\{([^}]*)\}/g)];
    expect(blocks.length).toBeGreaterThanOrEqual(3);
    for (const [, name, body] of blocks) {
      const steps = [...body.matchAll(/--id-accent-(\d+):/g)].map((m) => Number(m[1]));
      expect(
        steps.sort((a, b) => a - b),
        `"${name}" yönünde eksik accent adımı var`,
      ).toEqual([50, 100, 200, 300, 400, 500, 600, 700, 800, 900, 950]);

      // Yaricap ve notr de TAM olmali; eksigi kalan adim varsayilan degerinde
      // kalir ve sayfada iki farkli dil yan yana gorunur.
      const radii = [...body.matchAll(/--id-radius-(\w+):/g)].map((m) => m[1]);
      expect(radii.sort(), `"${name}" yönünde eksik yarıçap adımı var`).toEqual([
        "lg", "md", "sm", "xl",
      ]);
      const neutrals = [...body.matchAll(/--id-neutral-(\d+):/g)].map((m) => Number(m[1]));
      expect(neutrals.sort((a, b) => a - b), `"${name}" yönünde eksik nötr adımı var`).toEqual([
        50, 100, 200, 300,
      ]);
    }
  });

  it("durum renkleri kimliğe bağlanmadı — bilerek", () => {
    // emerald/amber/blue basari, uyari ve bilgi renkleridir; kimlikle degismemeli.
    // Yesil bir "basarili" rozeti yon degistirdi diye turuncuya donerse anlam kayar.
    for (const c of ["emerald", "amber", "blue"]) {
      expect(css).not.toMatch(new RegExp(`--color-${c}-600:\\s*var\\(--id-`));
    }
  });
});

describe("görsel kimlik tek yerden karar veriliyor", () => {
  it("kimlik katmanı ve üç yön tanımlı", () => {
    const css = fs.readFileSync("src/app/[locale]/globals.css", "utf8");
    expect(css).toMatch(/KİMLİK KATMANI/);
    for (const id of SITE_IDENTITIES.filter((i) => i !== "default")) {
      expect(css, `[data-identity="${id}"] bloğu yok`).toMatch(
        new RegExp(`\\[data-identity="${id}"\\]`),
      );
    }
  });

  it("kimlik sınıfları token'ları tüketiyor, sabit değer taşımıyor", () => {
    const css = fs.readFileSync("src/app/[locale]/globals.css", "utf8");
    const layer = css.slice(css.indexOf("KİMLİK SINIFLARI"));
    // `.id-*` sinifi bir REFERANS olmali; icine hex/hsl gomulurse kimlik
    // katmani baypas edilmis olur ve yon degistirmek yine ise yaramaz.
    const idBlock = layer.match(/\.id-[a-z-]+\s*\{[^}]*\}/g) ?? [];
    expect(idBlock.length).toBeGreaterThan(5);
    const hardcoded = idBlock.filter((b) => /#[0-9a-f]{3,8}\b|hsl\(/i.test(b));
    expect(
      hardcoded,
      "`.id-*` sınıfları sabit renk taşıyor — kimlik katmanı baypas ediliyor",
    ).toEqual([]);
  });

  it("varsayılan = sitenin kendi görünümü; öznitelik basılmaz", () => {
    // "default" degerleri :root'ta durur, fazladan secici gerekmez. 24 Agustos'ta
    // varsayilan kisa sure "fis" dilindeydi; 25 Agustos'ta geri alindi ve fis
    // `ticket` yonu olarak kaldi. Bu bekleyis o geri alisi kilitler.
    expect(siteIdentityAttribute("default")).toEqual({});
    expect(siteIdentityAttribute("ticket")).toEqual({ "data-identity": "ticket" });
    // Bilinmeyen deger sessizce varsayilana duser; yanlis bir env sayfayi bozmaz.
    expect(resolveSiteIdentity("bilinmeyen")).toBe("default");
    expect(resolveSiteIdentity(undefined)).toBe("default");
    expect(resolveSiteIdentity("  TICKET ")).toBe("ticket");
  });
});

describe("token sistemini baypas eden değer yok", () => {
  it("arbitrary yarıçap kalmadı", () => {
    // `rounded-[2.5rem]` token sistemini TAMAMEN baypas eder: kimlik degisince
    // geri kalan her sey keskinlesirken bunlar yuvarlak kalirdi. 125 tanesi
    // 53 dosyada skalaya tasindi (eski gorunumle birebir esdeger adimlara).
    const { total, byFile } = countMatches(/\brounded-\[[^\]]+\]/g);
    expect(
      total,
      `Arbitrary yarıçap ${total} adet. Skala adımlarını kullanın ` +
        `(rounded-xl/2xl/3xl/4xl) — arbitrary değer kimliğe bağlanamaz.\n${report(byFile)}`,
    ).toBe(0);
  });
});

describe("sabit stil borcu artmıyor (mandal)", () => {
  const cases: Array<[keyof typeof CEILINGS, RegExp, string]> = [
    ["accentColor", /\borange-(?:50|100|200|300|400|500|600|700|800|900)\b/g, ".id-accent / .id-accent-bg"],
    ["displayWeight", /\bfont-black\b/g, ".id-display"],
    ["eyebrowTracking", /\btracking-widest\b/g, ".id-eyebrow"],
    ["surfaceRadius", /\brounded-(?:3xl|\[2rem\]|\[2\.5rem\])\b/g, ".id-surface"],
  ];

  it.each(cases)("%s tavanı aşılmıyor", (key, re, replacement) => {
    const { total, byFile } = countMatches(re);
    expect(
      total,
      `Sabit kullanım ${total}, tavan ${CEILINGS[key]}. Yerine \`${replacement}\` kullanın — ` +
        `sabit sınıf bir KARARDIR ve kimlik katmanını baypas eder.\n${report(byFile)}`,
    ).toBeLessThanOrEqual(CEILINGS[key]);
  });

  it("borcun nerede olduğu görünür — sessiz birikmesin", () => {
    // Test kendisi bir rapordur: calistiran, gocun nereden baslamasi
    // gerektigini gorur (en cok tekrar eden dosyalar).
    for (const [, re] of cases) {
      const { byFile } = countMatches(re);
      if (byFile.length > 0) expect(byFile[0][1]).toBeGreaterThan(0);
    }
  });
});
