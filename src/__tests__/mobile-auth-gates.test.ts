import { describe, it, expect } from "vitest";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { stripComments } from "./helpers/strip-comments";

/**
 * MOBIL UCLARDA YETKI KAPISI ELLE YAZILMAZ.
 *
 * `action-auth.test.ts` bu kurali WEB action'lari icin olcuyor: rol kontrolu
 * `requireAdmin`/`requirePartner` uzerinden yapilir, action icinde elle
 * yazilmaz. Mobil uclar icin ayni kural CLAUDE.md'de yazili ama OLCULMUYORDU.
 *
 * Bosluk 2026-09-02'de bir taramada gorundu: `mobile/admin/stats` kendi
 * kapisini yaziyordu --
 *
 *     if (auth.user.role !== "ADMIN") { ... 403 ... }
 *
 * -- digger uc admin ucu `requireRole` cagirirken. Govdeler tesaduefen ayniydi,
 * yani gorunur bir hata yoktu; tehlike, kopya kapinin degistigi gun tek yerde
 * degismesi.
 *
 * Ayrica `requireMobileUser` FIRLATMAZ, `{ error }` DONER (CLAUDE.md). Donusu
 * kontrol edilmeyen bir uc, kimligi dogrulanmamis istegi kabul eder -- o yuzden
 * her cagrinin ardindan kontrol araniyor.
 */

function mobilUclar(): { yol: string; src: string }[] {
  const kok = join(process.cwd(), "src/app/api/mobile");
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

describe("mobil uclarda yetki kapilari", () => {
  const uclar = mobilUclar();

  it("taranacak uc bulundu", () => {
    expect(uclar.length).toBeGreaterThan(30);
  });

  it("elle rol karsilastirmasi YOK -- requireRole kullanilir", () => {
    const ihlaller: string[] = [];
    for (const { yol, src } of uclar) {
      src.split("\n").forEach((satir, i) => {
        // `user.role !== "ADMIN"` / `=== "PARTNER"` gibi elle kapilar.
        if (/\.role\s*(!==|===)\s*["'](ADMIN|PARTNER|GUEST)["']/.test(satir)) {
          ihlaller.push(`${yol}:${i + 1}`);
        }
      });
    }
    expect(
      ihlaller,
      `elle rol kapisi -- \`requireRole(auth.user, [...])\` kullanin:\n${ihlaller.join("\n")}`,
    ).toEqual([]);
  });

  it("requireMobileUser donusu HER cagirida kontrol ediliyor", () => {
    const ihlaller: string[] = [];
    for (const { yol, src } of uclar) {
      const cagri = (src.match(/await requireMobileUser\(/g) ?? []).length;
      if (cagri === 0) continue;
      const kontrol = (src.match(/["']error["']\s+in\s+auth/g) ?? []).length;
      if (kontrol < cagri) ihlaller.push(`${yol} (${cagri} cagri, ${kontrol} kontrol)`);
    }
    expect(
      ihlaller,
      `\`requireMobileUser\` firlatmaz, \`{ error }\` doner -- donusu kontrol edilmeyen uc kimligi dogrulanmamis istegi kabul eder:\n${ihlaller.join("\n")}`,
    ).toEqual([]);
  });
});
