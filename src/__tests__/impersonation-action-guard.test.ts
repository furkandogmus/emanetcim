import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";

/**
 * Web "olarak goruntule" icin server action kapisi (mandal). Goruntulemede kimlik yalniz
 * `auth()`tan gelir; action'lar onu `action-auth` uzerinden okumali (`require*` ya da
 * `actionSession`), dogrudan `@/auth` import etmemeli. Hedefin gozuyle calisan salt okuma
 * action'lari asagidaki listeyle sinirli: yeni bir giris bilincli bir karar olmali.
 */

const ACTIONS_DIR = path.join(process.cwd(), "src/actions");

const READ_SCOPE_ALLOWLIST = [
  "affiliate.ts:previewAffiliateCheckoutAction",
  "referral.ts:validateReferralCodeAction",
  "search-shops.ts:refreshSearchShopsAction",
];

function actionFiles(): string[] {
  return fs
    .readdirSync(ACTIONS_DIR)
    .filter((f) => f.endsWith(".ts") && !f.endsWith(".test.ts"))
    .sort();
}

describe("goruntuleme action kapisi", () => {
  it("hicbir server action `@/auth`u dogrudan import etmez", () => {
    const offenders = actionFiles().filter((f) =>
      /from\s+["']@\/auth["']/.test(fs.readFileSync(path.join(ACTIONS_DIR, f), "utf8")),
    );
    expect(offenders, "auth() yerine action-auth'taki actionSession/require* kullanin").toEqual([]);
  });

  it("server action'lar yalniz src/actions altinda (baska 'use server' yok)", () => {
    const stray: string[] = [];
    const walk = (dir: string) => {
      for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
        const p = path.join(dir, e.name);
        if (e.isDirectory()) {
          if (e.name !== "__tests__" && e.name !== "actions") walk(p);
        } else if (/\.(ts|tsx)$/.test(e.name) && /^\s*["']use server["']/m.test(fs.readFileSync(p, "utf8"))) {
          stray.push(path.relative(process.cwd(), p));
        }
      }
    };
    walk(path.join(process.cwd(), "src"));
    expect(stray).toEqual([]);
  });

  it("okuma kapsami listesi sabit", () => {
    const found: string[] = [];
    for (const f of actionFiles()) {
      const src = fs.readFileSync(path.join(ACTIONS_DIR, f), "utf8");
      for (const m of src.matchAll(/export async function (\w+)\([^)]*\)[^{]*\{\s*return asImpersonationRead\(/g)) {
        found.push(`${f}:${m[1]}`);
      }
      const uses = (src.match(/asImpersonationRead\(/g) ?? []).length;
      const wrapped = found.filter((x) => x.startsWith(`${f}:`)).length;
      expect(uses, `${f}: asImpersonationRead yalniz ihrac edilen action'i saran kalipla`).toBe(wrapped);
    }
    expect(found.sort()).toEqual(READ_SCOPE_ALLOWLIST);
  });
});
