import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";

/**
 * Web "olarak goruntule" icin server action kapisi (mandal). Goruntulemede kimlik yalniz
 * `auth()`tan gelir; action'lar onu `action-auth` uzerinden okumali (`require*` ya da
 * `actionSession`), `src/auth` modulunu hicbir bicimde import etmemeli. Hedefin gozuyle
 * calisan salt okuma action'lari asagidaki listeyle sinirli: yeni giris bilincli bir karar.
 */

const SRC = path.join(process.cwd(), "src");
const AUTH_MODULE = path.join(SRC, "auth");
const EXT = /\.(ts|tsx|js|mjs)$/;

const READ_SCOPE_ALLOWLIST = [
  "src/actions/affiliate.ts:previewAffiliateCheckoutAction",
  "src/actions/bag-photos.ts:listBagPhotosAction",
  "src/actions/referral.ts:validateReferralCodeAction",
  "src/actions/search-shops.ts:refreshSearchShopsAction",
];

function walk(dir: string, out: string[] = []): string[] {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) {
      if (e.name !== "__tests__" && e.name !== "node_modules") walk(p, out);
    } else if (EXT.test(e.name) && !/\.test\.(ts|tsx|js|mjs)$/.test(e.name)) {
      out.push(p);
    }
  }
  return out;
}

const files = walk(SRC);
const rel = (p: string) => path.relative(process.cwd(), p);
const isServerActionFile = (src: string) => /^\s*(\/\/[^\n]*\n\s*)*["']use server["']/.test(src);

/** Statik `from`, yan etki `import "x"` ve dinamik `import("x")` belirtecleri. */
function importSpecifiers(src: string): string[] {
  const out: string[] = [];
  for (const m of src.matchAll(/(?:from\s+|import\s+|import\s*\(\s*)["'`]([^"'`]+)["'`]/g)) out.push(m[1]);
  return out;
}

function resolvesToAuth(spec: string, fromFile: string): boolean {
  if (spec === "@/auth") return true;
  if (spec.startsWith("@/")) return path.join(SRC, spec.slice(2)) === AUTH_MODULE;
  if (spec.startsWith(".")) return path.resolve(path.dirname(fromFile), spec).replace(EXT, "") === AUTH_MODULE;
  return false;
}

describe("goruntuleme action kapisi", () => {
  it("cozucu kendini dogruluyor: takma ad, goreli ve dinamik bicimler yakalanir", () => {
    const fake = path.join(SRC, "actions", "x.ts");
    for (const src of [
      'import { auth } from "@/auth";',
      'import { auth } from "../auth";',
      'const { auth } = await import("@/auth");',
      'const m = await import("../auth.ts");',
    ]) {
      expect(importSpecifiers(src).some((s) => resolvesToAuth(s, fake)), src).toBe(true);
    }
    expect(importSpecifiers('import x from "@/auth.config";').some((s) => resolvesToAuth(s, fake))).toBe(false);
  });

  it("server action dosyalari `src/auth`u hicbir bicimde import etmez", () => {
    const actionFiles = files.filter((f) => isServerActionFile(fs.readFileSync(f, "utf8")));
    expect(actionFiles.length).toBeGreaterThan(10);
    const offenders = actionFiles.filter((f) =>
      importSpecifiers(fs.readFileSync(f, "utf8")).some((s) => resolvesToAuth(s, f)),
    );
    expect(offenders.map(rel), "auth() yerine action-auth'taki actionSession/require* kullanin").toEqual([]);
  });

  it("okuma kapsami depoda yalniz listedeki action'larda", () => {
    const found: string[] = [];
    let calls = 0;
    for (const f of files) {
      if (rel(f) === "src/lib/impersonation-read-scope.ts") continue;
      const src = fs.readFileSync(f, "utf8");
      calls += (src.match(/asImpersonationRead\s*\(/g) ?? []).length;
      for (const m of src.matchAll(/export async function (\w+)\([^)]*\)[^{]*\{\s*return asImpersonationRead\(/g)) {
        found.push(`${rel(f)}:${m[1]}`);
      }
    }
    expect(found.sort()).toEqual(READ_SCOPE_ALLOWLIST);
    expect(calls, "asImpersonationRead yalniz ihrac edilen action'i saran kalipla").toBe(READ_SCOPE_ALLOWLIST.length);
  });
});
