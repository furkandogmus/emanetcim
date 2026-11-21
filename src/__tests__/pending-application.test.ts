import { describe, it, expect } from "vitest";
import { PENDING_APPLICATION_WHERE } from "@/lib/pending-application";

describe("bekleyen başvuru tanımı", () => {
  it("onaylanmamış, pasif ve rezervasyonsuz dükkanı kapsar", () => {
    // Pasife alinmis canli dukkan listeye dusup "Reddet" ile silinmesin.
    expect(PENDING_APPLICATION_WHERE).toEqual({
      isActive: false,
      isPrelaunch: false,
      approvedAt: null,
      bookings: { none: {} },
    });
  });
});

import { phoneSearchDigits } from "@/lib/admin-phone-search";

describe("admin telefon araması", () => {
  it("yazım biçimi ne olursa olsun 10 haneye iner", () => {
    for (const q of ["0532 123 45 67", "+90 532 123 45 67", "(532) 123-45-67", "5321234567", "905321234567"]) {
      expect(phoneSearchDigits(q)).toBe("5321234567");
    }
  });
  it("kısmi yazımı eşler, çok kısa diziyi yok sayar", () => {
    expect(phoneSearchDigits("0532 123 4")).toBe("5321234");
    expect(phoneSearchDigits("0532 123")).toBeNull();
    expect(phoneSearchDigits("158D19")).toBeNull();
  });
});

import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) {
      if (name !== "__tests__") walk(p, out);
    } else if (/\.tsx?$/.test(name)) out.push(p);
  }
  return out;
}

describe("bekleyen başvuru tek tanım (mandal)", () => {
  it("`shop.findMany/count({ where: { isActive: false } })` yalnız pending-application.ts üzerinden", () => {
    const re = /shop\.(findMany|count)\(\s*\{\s*where:\s*\{\s*isActive:\s*false/;
    const offenders = walk(join(process.cwd(), "src")).filter((f) => re.test(readFileSync(f, "utf-8")));
    expect(offenders).toEqual([]);
  });
});
