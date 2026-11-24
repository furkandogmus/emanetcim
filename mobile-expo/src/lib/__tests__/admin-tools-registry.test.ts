import { describe, expect, it, jest } from "@jest/globals";
import fs from "node:fs";
import path from "node:path";

import { ADMIN_MANAGE_LINKS, ADMIN_TOOL_SECTIONS, ADMIN_WEB_SECTIONS } from "@/lib/admin-tools";

// Simgeler ESM paket; kayit testinde yalniz yollar olculur (jest.mock ithalatin ustune tasinir).
jest.mock("lucide-react-native", () => new Proxy({}, { get: () => () => null }));

const ADMIN_DIR = path.join(__dirname, "../../app/(admin)");

describe("yonetici arac kaydi", () => {
  const links = [...ADMIN_MANAGE_LINKS, ...ADMIN_TOOL_SECTIONS.flatMap((s) => s.links)];

  it("her uygulama ici baglantinin ekran dosyasi var", () => {
    const missing = links
      .map((l) => String(l.href))
      .filter((href) => !fs.existsSync(path.join(ADMIN_DIR, `${href.replace(/^\//, "")}.tsx`)));
    expect(missing).toEqual([]);
  });

  it("anahtarlar tekil", () => {
    const keys = links.map((l) => l.key);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it("uygulamada ekrani olan is web listesinde kalmaz", () => {
    expect(ADMIN_WEB_SECTIONS).not.toContain("partners");
    const inApp = new Set(links.map((l) => String(l.href).replace(/^\/admin\//, "")));
    expect(ADMIN_WEB_SECTIONS.filter((s) => inApp.has(s))).toEqual([]);
  });
});
