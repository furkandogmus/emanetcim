/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import fs from "node:fs";
import path from "node:path";
import Money from "@/components/common/Money";
import { formatDecimal, formatTryCurrency } from "@/lib/currency";

/**
 * Para ve sayı gösterimi.
 *
 * Neden var (2026-08-22): uygulamada tutarlar 17 yerde ham olarak `₺{sayı}`
 * basılıyordu ve sonuçlar yanlıştı:
 *   `₺1520`  → doğrusu `₺1.520,00`   (binlik ayracı yok)
 *   `₺12.5`  → doğrusu `₺12,50`      (TR'de nokta BİNLİK ayracıdır)
 * Ayrıca dükkan detayının yapışkan fiyat çubuğunda zaten biçimlendirilmiş bir
 * değerin başına bir `₺` daha ekleniyordu: ekranda **"₺₺50,00"** yazıyordu.
 */

const mockLocale = vi.hoisted(() => ({ value: "tr" }));
vi.mock("next-intl", () => ({ useLocale: () => mockLocale.value }));

describe("Money bileşeni", () => {
  it("binlik ayracı ve kuruş uygular", () => {
    render(<Money amount={1520} />);
    expect(screen.getByText("₺1.520,00")).toBeTruthy();
  });

  it("ondalık ayracı TR'de VİRGÜL — nokta binlik ayracı gibi okunur", () => {
    render(<Money amount={12.5} />);
    expect(screen.getByText("₺12,50")).toBeTruthy();
  });

  it("compact kuruşu gizler ama binlik ayracını korur", () => {
    render(<Money amount={1520} compact />);
    expect(screen.getByText("₺1.520")).toBeTruthy();
  });

  it("çıktı ASLA çift para işareti içermez", () => {
    // Ekranda "₺₺50,00" yaziyordu.
    const { container } = render(<Money amount={50} />);
    expect(container.textContent).not.toContain("₺₺");
  });

  it("tutar satır kırmasına uğramaz", () => {
    // "₺1.520," / "00" diye bolunmus bir tutar okunamaz.
    const { container } = render(<Money amount={1520} />);
    const el = container.querySelector("span");
    expect(el?.style.whiteSpace).toBe("nowrap");
  });

  it("geçersiz sayı NaN basmaz", () => {
    const { container } = render(<Money amount={NaN} />);
    expect(container.textContent).not.toContain("NaN");
    expect(container.textContent).toContain("0");
  });

  it("locale'i takip eder — Almanca'da ayraçlar değişir", () => {
    mockLocale.value = "de";
    const { container } = render(<Money amount={1520.5} />);
    expect(container.textContent).toContain("1.520,50");
    mockLocale.value = "tr";
  });
});

describe("formatDecimal", () => {
  it("puanı locale'e göre biçimlendirir", () => {
    expect(formatDecimal(4.5, "tr")).toBe("4,5");
    expect(formatDecimal(4.5, "en")).toBe("4.5");
  });

  it("tam sayıya ondalık ekler — 5 değil 5,0", () => {
    expect(formatDecimal(5, "tr")).toBe("5,0");
  });

  it("geçersiz değer NaN basmaz", () => {
    expect(formatDecimal(NaN, "tr")).toBe("0,0");
    expect(formatDecimal(Infinity, "tr")).toBe("0,0");
  });
});

describe("ham para gösterimi kalmadı — mandal", () => {
  /**
   * `₺{...}` kalıbı JSX'te doğrudan kullanılmamalı; `Money` bileşeni kullanılmalı.
   * Aksi halde binlik ayracı ve ondalık gösterimi yine kaybolur.
   */
  function walk(dir: string, out: string[] = []): string[] {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      const p = path.join(dir, e.name);
      if (e.isDirectory()) walk(p, out);
      else if (e.name.endsWith(".tsx")) out.push(p);
    }
    return out;
  }

  it("hiçbir bileşende ham `₺{` kalmadı", () => {
    const offenders: string[] = [];
    for (const root of ["src/components", "src/app"]) {
      const abs = path.join(process.cwd(), root);
      if (!fs.existsSync(abs)) continue;
      for (const file of walk(abs)) {
        if (file.endsWith(path.join("common", "Money.tsx"))) continue;
        const src = fs
          .readFileSync(file, "utf8")
          .replace(/\/\*[\s\S]*?\*\//g, "")
          .replace(/^\s*\/\/.*$/gm, "")
          .replace(/\{\/\*[\s\S]*?\*\/\}/g, "");
        if (src.includes("₺{")) offenders.push(path.relative(process.cwd(), file));
      }
    }
    expect(
      offenders,
      `Bu dosyalar ham \`₺{...}\` kullanıyor; \`<Money amount={...} />\` kullanın:\n` +
        offenders.map((o) => `  ${o}`).join("\n"),
    ).toEqual([]);
  });
});

describe("formatTryCurrency sözleşmesi", () => {
  it("para birimi simgesini KENDİSİ ekler — çağıran eklememelidir", () => {
    expect(formatTryCurrency(50, "tr")).toContain("₺");
  });
});
