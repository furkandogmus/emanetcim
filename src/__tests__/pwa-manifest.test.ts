import { describe, it, expect } from "vitest";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { APP_LOCALES } from "@/i18n/locales";
import { buildManifest } from "@/lib/pwa-manifest";

/** Dile gore PWA manifest'i (2026-09-23): her dil kendi metnini ve yolunu tasir. */
describe("PWA manifest", () => {
  it.each(APP_LOCALES)("%s: dil, yon, baslangic ve kisayollar o dilde", async (locale) => {
    const m = await buildManifest(locale);
    expect(m.id).toBe("/");
    expect(m.lang).toBe(locale);
    expect(m.dir).toBe(locale === "fa" ? "rtl" : "ltr");
    expect(m.start_url).toBe(`/${locale}?utm_source=pwa`);
    for (const s of m.shortcuts ?? []) {
      expect(s.url.startsWith(`/${locale}/`)).toBe(true);
      expect(s.name).toBeTruthy();
    }
  });

  it("ikon ve ekran goruntusu dosyalari public/ altinda var", async () => {
    const m = await buildManifest("tr");
    const files = [...(m.icons ?? []), ...(m.screenshots ?? [])].map((i) => i.src);
    for (const f of files) expect(existsSync(join(process.cwd(), "public", f)), f).toBe(true);
  });
});
