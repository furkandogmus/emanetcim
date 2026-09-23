import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

/**
 * ISTEMCIDE OKUNAN HER NEXT_PUBLIC_* DEGISKENI IMAJA GOMULUYOR.
 *
 * Olculdu (2026-09-23): Next `NEXT_PUBLIC_*` degerlerini `next build` aninda
 * pakete gomer ve sonra DONDURUR (node_modules/next/dist/docs/01-app/02-guides/
 * environment-variables.md). Plausible, Crisp ve web push anahtarlari yalnizca
 * compose ile calisma zamaninda veriliyordu; canli pakette deger yoktu ve uc
 * ozellik de prod'da HIC calismadi -- hicbir hata vermeden.
 *
 * Kural: `"use client"` dosyasinda okunan her NEXT_PUBLIC_* icin Dockerfile'da
 * `ARG` ve CI imaj derlemesinde `build-args` satiri olmali.
 */
const BILINCLI_BOS = new Set([
  // Yalnizca E2E demo girisi; uretim imajinda BOS kalmali.
  "NEXT_PUBLIC_DEMO_PASSWORD",
]);

function dosyalar(dir: string): string[] {
  return readdirSync(dir).flatMap((ad) => {
    const yol = join(dir, ad);
    if (statSync(yol).isDirectory()) return ad === "__tests__" ? [] : dosyalar(yol);
    return /\.(ts|tsx)$/.test(ad) ? [yol] : [];
  });
}

describe("NEXT_PUBLIC_* derleme argumanlari", () => {
  const kok = process.cwd();
  const istemci = new Set<string>();
  for (const f of dosyalar(join(kok, "src"))) {
    const src = readFileSync(f, "utf-8");
    if (!/^\s*["']use client["']/.test(src)) continue;
    for (const m of src.matchAll(/process\.env\.(NEXT_PUBLIC_[A-Z0-9_]+)/g)) istemci.add(m[1]);
  }
  const dockerfile = readFileSync(join(kok, "Dockerfile"), "utf-8");
  const ci = readFileSync(join(kok, ".github/workflows/ci.yml"), "utf-8");

  it.each([...istemci].filter((v) => !BILINCLI_BOS.has(v)).sort())(
    "%s Dockerfile ARG ve CI build-args'ta",
    (v) => {
      expect(dockerfile, `Dockerfile'da ARG ${v} yok`).toMatch(new RegExp(`^ARG ${v}\\b`, "m"));
      expect(ci, `ci.yml build-args'ta ${v}= yok`).toMatch(new RegExp(`^\\s+${v}=`, "m"));
    },
  );
});
