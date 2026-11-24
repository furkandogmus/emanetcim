import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { redactMoneyPropsForStaff, redactPulseForStaff } from "@/lib/partner-panel-redaction";

const PULSE = { todayArrivals: 3, todayPickups: 1, bagsInStorage: 4, monthNet: 900, prevMonthNet: 600, monthChangePct: 50, bagsHandledAllTime: 12 };
const MONEY = { totalEarnings: 5000, merchantShareRatio: 0.9, initialPricePerDay: 250, marketPrice: 250, initialPhone: "05000000000", commissionActive: true };

describe("personel paneli: kazanc RSC yukune girmez", () => {
  it("personelde kazanc alanlari sifir, gunluk sayilar kalir", () => {
    expect(redactPulseForStaff(PULSE, false)).toEqual({ ...PULSE, monthNet: 0, prevMonthNet: 0, monthChangePct: null });
    expect(redactPulseForStaff(PULSE, true)).toBe(PULSE);
  });

  it("personelde esnaf payi, toplam, fiyat ve sahip telefonu gitmez", () => {
    const r = redactMoneyPropsForStaff(MONEY, false);
    expect(r).toEqual({ totalEarnings: 0, merchantShareRatio: 0, initialPricePerDay: 0, marketPrice: 0, initialPhone: "", commissionActive: false });
    expect(redactMoneyPropsForStaff(MONEY, true)).toBe(MONEY);
  });

  it("panel sayfasi istemciye yalniz ayiklanmis degerleri verir", () => {
    const src = fs.readFileSync(path.join(process.cwd(), "src/app/[locale]/partner/page.tsx"), "utf8");
    expect(src).toMatch(/redactPulseForStaff\(/);
    expect(src).toMatch(/merchantShareRatio=\{money\.merchantShareRatio\}/);
    expect(src).toMatch(/totalEarnings=\{money\.totalEarnings\}/);
    expect(src).not.toMatch(/merchantShareRatio=\{commission\./);
    expect(src).not.toMatch(/pulse=\{await/);
  });
});
