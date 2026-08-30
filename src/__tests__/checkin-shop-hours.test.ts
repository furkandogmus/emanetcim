import { describe, it, expect } from "vitest";
import { isShopOpenForHandover, isShopOpenForStay } from "@/lib/shop-hours";

/**
 * CHECK-IN KAPISI ile ARAMA aynı soruyu aynı şekilde cevaplamalı.
 *
 * NEDEN (2026-08-31, esnaf panelinde gezilirken bulundu): `check-in.ts`
 * doğrudan `isShopOpenAt` çağırıyordu ve iki alanı sessizce düşürüyordu —
 * `open247` ve dükkanın saat dilimi. Arama tarafı (`isShopOpenForStay`) ikisini
 * de dikkate alıyor. İki taraf ayrışınca bedeli MİSAFİR öder: 24/7 işaretli bir
 * dükkan aramada gece slotunu satar, misafir valiziyle gelir ve tezgâhta
 * "dükkan kapalı" yer.
 *
 * Hatanın sinsi tarafı: bugün üretimdeki üç dükkanın üçü de Türkiye'de ve
 * saatleri 00:00–23:59, yani hiçbir belirti üretmiyor. İlk yurt dışı esnafı ya
 * da varsayılan saatlerini değiştirmemiş ilk 24/7 dükkan ortaya çıkarır.
 */
const NIGHT = new Date("2026-09-01T19:00:00Z"); // İstanbul'da 22:00

describe("isShopOpenForHandover", () => {
  it("open247 dukkanda saatlere HIC bakmaz", () => {
    // Şema varsayılanı 09:00–20:00 duruyor ama dükkan 24/7 işaretli.
    expect(isShopOpenForHandover("09:00", "20:00", true, NIGHT)).toBe(true);
  });

  it("open247 degilse saatleri uygular", () => {
    expect(isShopOpenForHandover("09:00", "20:00", false, NIGHT)).toBe(false);
    expect(isShopOpenForHandover("09:00", "23:59", false, NIGHT)).toBe(true);
  });

  it("dukkanin SAAT DILIMINI kullanir, sunucununkini degil", () => {
    // Aynı an: İstanbul'da 22:00 (kapalı), Londra'da 20:00 (sınırda açık).
    expect(isShopOpenForHandover("09:00", "20:30", false, NIGHT, "Europe/Istanbul")).toBe(false);
    expect(isShopOpenForHandover("09:00", "20:30", false, NIGHT, "Europe/London")).toBe(true);
  });

  it("ARAMA ile ayni cevabi verir -- ayrisirlarsa misafir odiyor", () => {
    /**
     * Aramanın sattığı her an, check-in'in de kabul ettiği an olmalı. Aksi
     * halde sistem tutamayacağı bir söz satmış olur.
     */
    const cases: Array<[string, string, boolean, string]> = [
      ["09:00", "20:00", true, "Europe/Istanbul"],
      ["09:00", "20:00", false, "Europe/Istanbul"],
      ["00:00", "23:59", false, "Asia/Tokyo"],
      ["09:00", "20:00", false, "America/New_York"],
    ];
    for (const [open, close, open247, tz] of cases) {
      const search = isShopOpenForStay(open, close, open247, NIGHT, NIGHT, tz);
      const handover = isShopOpenForHandover(open, close, open247, NIGHT, tz);
      expect(handover, `${tz} ${open}-${close} 247:${open247}`).toBe(search);
    }
  });
});

describe("check-in kapisi duzeltmeyi kullaniyor", () => {
  it("check-in.ts artik ham isShopOpenAt cagirmiyor", async () => {
    const fs = await import("node:fs");
    const src = fs.readFileSync("src/services/booking/check-in.ts", "utf8");
    // Ham cagri geri gelirse `open247` ve saat dilimi yine sessizce duser.
    expect(src).not.toMatch(/isShopOpenAt\s*\(/);
    expect(src).toContain("isShopOpenForHandover");
    expect(src).toContain("existing.shop.open247");
    expect(src).toContain("existing.shop.timezone");
  });
});
