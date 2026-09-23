import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * UYGULAMA WORKER'I HICBIR AG YANITINI ONBELLEGE YAZMAZ.
 *
 * 2026-08-23'te eski worker kaldirildi: yetkili API yanitlarini onbellege
 * aliyordu, yani bir kullanicinin verisi baska oturumda geri servis
 * edilebiliyordu. 2026-09-23'te push worker'ina cevrimdisi sayfa eklendi ve
 * herkese kuruldu; bu test o sinifin geri gelmesini engeller.
 */
const sw = readFileSync(join(process.cwd(), "public/push-sw.js"), "utf-8").replace(
  /\/\*[\s\S]*?\*\/|\/\/.*$/gm,
  "",
);

describe("push-sw.js guvenligi", () => {
  it("cache.put yok; onbellege yalnizca offline.html eklenir", () => {
    expect(sw).not.toMatch(/\.put\(/);
    expect(sw.match(/cache\.add(All)?\(/g) ?? []).toHaveLength(1);
    expect(sw).toMatch(/OFFLINE_URL = "\/offline\.html"/);
  });

  it("fetch yalnizca GET sayfa gezinmelerine yanit verir", () => {
    expect(sw).toMatch(/req\.mode !== "navigate" \|\| req\.method !== "GET"\) return;/);
  });

  it("offline.html kendi basina yeter: _next varligi ya da dis kaynak yok", () => {
    const html = readFileSync(join(process.cwd(), "public/offline.html"), "utf-8").replace(
      /<!--[\s\S]*?-->/g,
      "",
    );
    expect(html).not.toMatch(/_next\//);
    expect(html).not.toMatch(/(src|href)="https?:/);
  });
});
