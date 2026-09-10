import { describe, it, expect } from "vitest";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { stripComments } from "./helpers/strip-comments";

/**
 * `/api/admin/**` KENDI KAPISINI KURMAK ZORUNDA.
 *
 * NEDEN VAR (2026-09-10'da bulundu): `proxy.ts`teki `pathname.startsWith('/api/')`
 * erken donusu yuzunden `isAdminPath`/`isPartnerPath`in role-kontrolu blogu
 * `/api/admin/**` icin HICBIR ZAMAN calismiyordu -- `route-protection.test.ts`
 * yalniz saf yardimciyi izole test ettigi icin bu, middleware'in koruyor
 * gorunup koruMADIGI bir yanilsama yaratiyordu (`mobil-auth-gates.test.ts`nin
 * mobil uclar icin zaten olctugu ayni sinif). Bu mandal HER admin route'unun
 * kendi ADMIN rol kontrolunu tasidigini dogrudan kaynaktan olcuyor.
 */

/** `ADMIN_SETUP_KEY` ile korunan, KASITLI olarak oturumsuz calisan tek uc. */
const SESSIONLESS_EXCEPTIONS = new Set(["src/app/api/admin/setup/route.ts"]);

function adminRoutes(): { yol: string; src: string }[] {
  const kok = join(process.cwd(), "src/app/api/admin");
  const out: { yol: string; src: string }[] = [];
  const gez = (dir: string) => {
    for (const ad of readdirSync(dir)) {
      const tam = join(dir, ad);
      if (statSync(tam).isDirectory()) gez(tam);
      else if (ad === "route.ts") {
        out.push({
          yol: tam.replace(process.cwd() + "/", ""),
          src: stripComments(readFileSync(tam, "utf-8")),
        });
      }
    }
  };
  gez(kok);
  return out;
}

describe("/api/admin uclari kendi ADMIN kapisini tasir", () => {
  const routes = adminRoutes();

  it("taranacak uc bulundu", () => {
    expect(routes.length).toBeGreaterThan(0);
  });

  it("her uc (setup haric) ADMIN rol kontrolu iceriyor", () => {
    const ihlaller: string[] = [];
    for (const { yol, src } of routes) {
      if (SESSIONLESS_EXCEPTIONS.has(yol)) continue;
      const hasAuthCall = /\bauth\(\)|getMobileSession\(\)/.test(src);
      const hasAdminCheck = /["']ADMIN["']/.test(src);
      if (!hasAuthCall || !hasAdminCheck) {
        ihlaller.push(yol);
      }
    }
    expect(
      ihlaller,
      "Bu /api/admin ucları oturum + ADMIN rol kontrolü taşımıyor gibi görünüyor " +
        "(proxy.ts middleware'i /api/** için hiç bu kontrolü yapmıyor, tek savunma budur):\n" +
        ihlaller.join("\n"),
    ).toEqual([]);
  });
});
