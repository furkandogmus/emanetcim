import { describe, expect, it } from "@jest/globals";
import en from "@/locales/en.json";
import fa from "@/locales/fa.json";

type Tree = { [k: string]: string | string[] | Tree };
const flat = (o: Tree, p = ""): Record<string, string | string[]> =>
  Object.entries(o).reduce<Record<string, string | string[]>>((acc, [k, v]) => {
    if (v && typeof v === "object" && !Array.isArray(v)) Object.assign(acc, flat(v, `${p}${k}.`));
    else acc[`${p}${k}`] = v;
    return acc;
  }, {});
const vars = (s: string | string[]) => [...String(s).matchAll(/\{\{\s*([\w.]+)\s*\}\}/g)].map((m) => m[1]).sort();

describe("fa.json", () => {
  const E = flat(en as Tree);
  const F = flat(fa as Tree);

  it("en.json ile ayni anahtarlari tasir (cogul ekleri dahil)", () => {
    expect(Object.keys(F).sort()).toEqual(Object.keys(E).sort());
  });

  it("her ceviri ayni {{degisken}}leri tasir ve bos degildir", () => {
    for (const [k, v] of Object.entries(E)) {
      expect([k, vars(F[k])]).toEqual([k, vars(v)]);
      expect(String(F[k]).trim()).not.toBe("");
    }
  });
});
