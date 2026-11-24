import { describe, it, expect, beforeAll } from "vitest";
import { readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import ts from "typescript";

/**
 * `timeZone`SUZ TARİH BİÇİMLENDİRMESİ — TÜM `src` (mandal).
 *
 * NEDEN (2026-11-22, web kalite taraması): admin ve esnaf panellerinde ~20
 * çağrı `new Date(iso).toLocaleString(dateLocale, {...})` yazıyordu, `timeZone`
 * yoktu. Sunucu (konteyner UTC) ile tarayıcı farklı saat basıyor, hydration
 * uyuşmazlığı veriyordu; yurt dışındaki esnaf rezervasyon saatini kendi
 * cihazının saatinde görüyordu. Kolay yol `formatInstant`.
 *
 * TİP DENETLEYİCİSİYLE: metin kalıbı `count.toLocaleString(locale)` (sayı) ile
 * `d.toLocaleString(locale)` (tarih) arasını ayıramaz; alıcının tipi ayırır.
 * Yakalanan: `Date` üzerinde `toLocaleString`/`toLocaleDateString`/
 * `toLocaleTimeString`, ve `Intl.DateTimeFormat(...)` (`new` ile ya da
 * onsuz). Muaf olmak için `timeZone` AYNI ÇAĞRININ argümanlarında yazmalı;
 * seçenekler bir değişkense doğrulanamaz ve ihlal sayılır.
 */

/**
 * Dilimsiz biçimlendirmenin DOĞRU olduğu yerler (sayısı yalnızca düşer).
 *
 * `DateTimePicker`: biçimlendirdiği değer bir AN değil, cihaz diliminde kurulan
 * `datetime-local` duvar saati; aynı dilimde geri yazmak metni aynen gösterir.
 */
const JUSTIFIED: Record<string, number> = {
  "src/components/ui/DateTimePicker.tsx": 2,
};

const DATE_METHODS = new Set(["toLocaleString", "toLocaleDateString", "toLocaleTimeString"]);

function isIntlDateTimeFormat(expr: ts.Expression): boolean {
  return (
    ts.isPropertyAccessExpression(expr) &&
    expr.name.text === "DateTimeFormat" &&
    ts.isIdentifier(expr.expression) &&
    expr.expression.text === "Intl"
  );
}

function isDateType(type: ts.Type, checker: ts.TypeChecker): boolean {
  if (type.isUnion()) return type.types.some((t) => isDateType(t, checker));
  return checker.typeToString(type) === "Date";
}

function argsMentionTimeZone(args: ts.NodeArray<ts.Expression> | undefined, sf: ts.SourceFile): boolean {
  return (args ?? []).some((a) => /\btimeZone\b/.test(a.getText(sf)));
}

/** Bir kaynak dosyadaki dilimsiz tarih biçimlendirmelerinin satır numaraları. */
export function findUnzonedDateFormats(sf: ts.SourceFile, checker: ts.TypeChecker): number[] {
  const hits: number[] = [];
  const line = (n: ts.Node) => sf.getLineAndCharacterOfPosition(n.getStart(sf)).line + 1;

  const visit = (node: ts.Node) => {
    if (ts.isNewExpression(node) || ts.isCallExpression(node)) {
      if (isIntlDateTimeFormat(node.expression) && !argsMentionTimeZone(node.arguments, sf)) {
        hits.push(line(node));
      }
    }
    if (
      ts.isCallExpression(node) &&
      ts.isPropertyAccessExpression(node.expression) &&
      DATE_METHODS.has(node.expression.name.text)
    ) {
      const receiver = checker.getTypeAtLocation(node.expression.expression);
      if (isDateType(receiver, checker) && !argsMentionTimeZone(node.arguments, sf)) {
        hits.push(line(node));
      }
    }
    ts.forEachChild(node, visit);
  };
  visit(sf);
  return hits;
}

function sourceFiles(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) {
      if (name === "node_modules" || name === "__tests__") continue;
      sourceFiles(full, out);
    } else if (/\.tsx?$/.test(name) && !/\.test\.tsx?$/.test(name)) {
      out.push(full);
    }
  }
  return out;
}

const COMPILER_OPTIONS: ts.CompilerOptions = {
  target: ts.ScriptTarget.ES2017,
  lib: ["lib.dom.d.ts", "lib.esnext.d.ts"],
  jsx: ts.JsxEmit.ReactJSX,
  module: ts.ModuleKind.ESNext,
  moduleResolution: ts.ModuleResolutionKind.Bundler,
  strict: true,
  skipLibCheck: true,
  noEmit: true,
  esModuleInterop: true,
  resolveJsonModule: true,
  baseUrl: process.cwd(),
  paths: { "@/*": ["./src/*"] },
};

/*
  lib.dom/lib.esnext .d.ts'leri her parcacikta yeniden ayristirmak (~MB'larca)
  her `analyzeSnippet`i yuzlerce ms yapiyordu; paralel tam kosuda testler 5 sn
  sinirini asiyordu. Degismeyen dosyalar programlar arasinda paylasilir.
*/
const libSourceFiles = new Map<string, ts.SourceFile | undefined>();

/** Bellekteki tek dosyalık program: kalıp testleri için. */
function analyzeSnippet(code: string): number[] {
  const fileName = join(process.cwd(), "__snippet__.ts");
  const host = ts.createCompilerHost(COMPILER_OPTIONS);
  const base = { getSourceFile: host.getSourceFile, fileExists: host.fileExists, readFile: host.readFile };
  host.getSourceFile = (f, lang, ...rest) => {
    if (f === fileName) return ts.createSourceFile(f, code, lang, true);
    if (!libSourceFiles.has(f)) libSourceFiles.set(f, base.getSourceFile(f, lang, ...rest));
    return libSourceFiles.get(f);
  };
  host.fileExists = (f) => f === fileName || base.fileExists(f);
  host.readFile = (f) => (f === fileName ? code : base.readFile(f));
  const program = ts.createProgram([fileName], COMPILER_OPTIONS, host);
  return findUnzonedDateFormats(program.getSourceFile(fileName)!, program.getTypeChecker());
}

describe("src altında timeZone'suz tarih biçimlendirmesi yok (mandal)", () => {
  let found: Record<string, number[]> = {};

  beforeAll(() => {
    const files = sourceFiles(join(process.cwd(), "src"));
    const program = ts.createProgram(files, COMPILER_OPTIONS);
    const checker = program.getTypeChecker();
    found = {};
    for (const file of files) {
      const sf = program.getSourceFile(file);
      if (!sf) continue;
      const hits = findUnzonedDateFormats(sf, checker);
      if (hits.length) found[relative(process.cwd(), file)] = hits;
    }
  }, 120_000);

  it("istisna listesi dışında ihlal yok", () => {
    const offenders = Object.entries(found)
      .filter(([file]) => !(file in JUSTIFIED))
      .map(([file, lines]) => `${file}:${lines.join(",")}`);
    expect(
      offenders,
      `timeZone'suz tarih biçimlendirmesi -- \`formatInstant\` kullanın:\n${offenders.join("\n")}`,
    ).toEqual([]);
  });

  it("istisnalar tam tavanında (düşerse listeyi de düşürün; tarayıcının bozulmadığını da gösterir)", () => {
    for (const [file, ceiling] of Object.entries(JUSTIFIED)) {
      expect(found[file]?.length ?? 0, file).toBe(ceiling);
    }
  });
});

describe("findUnzonedDateFormats kalıbı", () => {
  // lib .d.ts'lerin tek seferlik ayristirmasi ilk teste yazilmasin; gercekten yavas bir ilk yukleme.
  beforeAll(() => {
    analyzeSnippet("export {};");
  }, 60_000);

  it("dilimsiz Date.toLocaleString (seçenekli, seçeneksiz, değişken üzerinde) yakalanır", () => {
    expect(analyzeSnippet(`const d = new Date(); d.toLocaleString("tr", { hour: "2-digit" });`)).toEqual([1]);
    expect(analyzeSnippet(`const d = new Date(); d.toLocaleString("tr");`)).toEqual([1]);
    expect(analyzeSnippet(`function f(d: Date) { return d.toLocaleString(); }`)).toEqual([1]);
  });

  it("seçenekler değişkense doğrulanamaz: ihlal", () => {
    expect(
      analyzeSnippet(`const o: Intl.DateTimeFormatOptions = { timeZone: "UTC" };\nnew Date().toLocaleDateString("tr", o);`),
    ).toEqual([2]);
  });

  it("Intl.DateTimeFormat new ile ve onsuz yakalanır", () => {
    expect(analyzeSnippet(`new Intl.DateTimeFormat("tr", { month: "long" });`)).toEqual([1]);
    expect(analyzeSnippet(`Intl.DateTimeFormat("tr").format(new Date());`)).toEqual([1]);
  });

  it("timeZone yalnızca AYNI çağrının içindeyse muaf", () => {
    expect(analyzeSnippet(`new Date().toLocaleDateString("en-CA", { timeZone: "UTC" });`)).toEqual([]);
    expect(analyzeSnippet(`const timeZone = "UTC";\nnew Intl.DateTimeFormat("tr", { timeZone });`)).toEqual([]);
    // Yakındaki satırda geçen `timeZone` artık muafiyet sağlamaz.
    expect(
      analyzeSnippet(`const d = new Date();\nconst timeZone = "UTC";\nd.toLocaleTimeString("tr");`),
    ).toEqual([3]);
  });

  it("sayı biçimlendirmesi geçer", () => {
    expect(analyzeSnippet(`const n = 3; n.toLocaleString("tr");`)).toEqual([]);
    expect(analyzeSnippet(`const n = 3; n.toLocaleString("tr", { maximumFractionDigits: 2 });`)).toEqual([]);
  });

  it("yorumdaki örnek ihlal sayılmaz", () => {
    expect(analyzeSnippet(`// new Date().toLocaleString("tr")\nexport {};`)).toEqual([]);
  });
});
