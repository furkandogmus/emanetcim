import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { stripComments } from "./helpers/strip-comments";

/**
 * MOBIL CHECKOUT KUPONU ISLIYOR.
 *
 * Olculdu (2026-09-02): mobil istemci `couponCode` alanini ZATEN gonderiyordu
 * (`mobile/lib/features/checkout/checkout_screen.dart`), ama sunucu semasi o
 * alani tanimlamiyordu -- zod sessizce ATIYOR -- ve ucta kuponu isleyen tek
 * satir yoktu.
 *
 * Sonuc: misafir kupon kodunu girer, uygulandigini sanir ve TAM FIYAT oder.
 * Web'de ayni kupon calisiyordu. CLAUDE.md'nin acikca uyardigi durum: "Bir is
 * kuralini web action'inda ve mobil API ucunda ayri ayri yazma" -- burada kural
 * mobilde hic yazilmamisti ve aradaki fark PARAYDI.
 *
 * Kupon sonrasi tutar DORT yerde birden kullanilmali: kayda yazilan tutar,
 * misafire giden e-posta, esnaf/admin bildirimi ve istemciye donen `totalPrice`
 * (istemci onu `serverTotal` olarak ekranda gosteriyor). Biri atlanirsa
 * misafir bir ekranda indirimli, digerinde tam fiyat gorur.
 */

const uc = stripComments(
  readFileSync(
    join(process.cwd(), "src/app/api/mobile/checkout/intent/route.ts"),
    "utf-8",
  ),
);

describe("mobil checkout kupon", () => {
  it("sema `couponCode` alanini taniyor", () => {
    expect(uc).toMatch(/couponCode:\s*z\.string\(\)/);
  });

  it("kupon ORTAK servisten aliniyor -- ayri aritmetik yok", () => {
    expect(uc).toContain("couponService.claim");
    expect(uc, "indirim elle hesaplanmamali").not.toMatch(/\*\s*\(1\s*-\s*discount/);
  });

  it("rezervasyon olusmazsa kupon hakki GERI VERILIYOR", () => {
    // Yoksa kampanya kotasi gerceklesmemis bir rezervasyon yuzunden yanar.
    expect(uc).toContain("couponService.release");
  });

  it("indirim deftere yaziliyor", () => {
    // "Bu rezervasyon neden 240 degil de 180?" sorusunun cevabi veride olmali.
    expect(uc).toContain("couponDiscountAmount");
    expect(uc).toContain("couponCode: appliedCouponCode");
  });

  it("kupon sonrasi tutar HER YERDE kullaniliyor", () => {
    /*
      `totals.subtotalBeforeCoupon` kupon ONCESI tutar. Fiyat gosterilen ya da
      kaydedilen hicbir yerde kalmamali; yalnizca kuponun uygulanacagi taban
      olarak bir kez gecer.
    */
    const kalan = (uc.match(/totals\.subtotalBeforeCoupon/g) ?? []).length;
    expect(kalan, "yalnizca kupon tabani olarak bir kez gecmeli").toBe(1);
    expect(uc).toMatch(/let toplam = totals\.subtotalBeforeCoupon;/);
    expect(uc).toMatch(/totalPrice: toplam,/);
  });

  it("web ile mobil AYNI servisi cagiriyor", () => {
    const web = stripComments(
      readFileSync(join(process.cwd(), "src/actions/booking.ts"), "utf-8"),
    );
    expect(web).toContain("couponService.claim");
    expect(web).toContain("couponService.release");
  });
});
