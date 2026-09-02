import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { stripComments } from "./helpers/strip-comments";

/**
 * IPTAL VE IADE HAKKI ATOMIK ALINIR.
 *
 * Gercek veritabaninda olculdu (2026-09-02). Ikisi de okuma-sonra-yazma
 * yarisindaydi: durum/bakiye okunuyor, kontrol ediliyor, sonra yaziliyor --
 * ve arada baska bir islem ayni seyi yapabiliyordu.
 *
 * IPTAL, dort es zamanli cagri:
 *
 *     ONCE : basarili 4/4, sadakat puani 500 -> 100, CANCELLED olayi 4
 *     SONRA: basarili 1/4, sadakat puani 500 -> 400, CANCELLED olayi 1
 *
 * Misafir uc yuz puanini haksiz yere kaybediyordu. Bu es zamanli iki istemci
 * gerektirmiyor: "Iptal Et"e iki kez basmak ya da agin istegi tekrarlamasi
 * yeter.
 *
 * IADE, bes es zamanli 40 TL istegi:
 *
 *     ONCE : besi de "basarili", besi de SAGLAYICIYA gitti; defter son yazani
 *            tuttugu icin 40 TL gorunuyordu -- kayit dogru, DUNYA yanlis
 *     SONRA: yalnizca biri gecti
 *
 * Bugun gorunmuyor cunku aktif saglayici tahsilat yapmiyor. PSP baglandigi gun
 * bu, musteriye bes kez para iadesi demek.
 */

const oku = (rel: string) => stripComments(readFileSync(join(process.cwd(), rel), "utf-8"));

describe("iptal hakki", () => {
  const src = oku("src/services/booking/lifecycle.ts");

  it("durum degisikligi KOSULLU", () => {
    expect(src).toMatch(/status: \{ notIn: \['CANCELLED', 'CHECKED_IN', 'CHECKED_OUT'\] \}/);
  });

  it("yarisi kaybeden yan etkilere GIRMEZ", () => {
    // `kilit.count === 0` erken donus: iade, puan dusumu, olay kaydi hicbiri
    // calismaz.
    expect(src).toMatch(/kilit\.count === 0/);
    const govde = src.slice(src.indexOf("const kilit = await prisma.booking.updateMany"));
    const pencere = govde.slice(0, 400);
    expect(pencere).toContain("INVALID_STATUS");
  });

  it("kilit IADEDEN once aliniyor", () => {
    /*
      Sira onemli: kilit iadeden sonra alinsaydi kaybeden cagrilar da
      saglayiciya gitmis olurdu.
    */
    expect(src.indexOf("const kilit = await prisma.booking.updateMany")).toBeLessThan(
      src.indexOf("paymentService.refund"),
    );
  });

  it("islem icinde durum TEKRAR yazilmiyor", () => {
    const tx = src.slice(src.indexOf("await prisma.$transaction(async (tx) => {"));
    expect(tx.slice(0, 600)).not.toMatch(/tx\.booking\.update\(\{[\s\S]{0,120}status: 'CANCELLED'/);
  });
});

describe("iade hakki", () => {
  const src = oku("src/services/PaymentService.ts");

  it("`refundedAmount` KOSULLU guncelleniyor", () => {
    expect(src).toMatch(/where: \{ id: log\.id, refundedAmount: log\.refundedAmount \}/);
  });

  it("kaybeden cagri SAGLAYICIYA gitmiyor", () => {
    expect(src.indexOf("paymentLog.updateMany")).toBeLessThan(
      src.indexOf("this.provider.refund"),
    );
    expect(src).toContain("CONCURRENT_MODIFICATION");
  });
});
