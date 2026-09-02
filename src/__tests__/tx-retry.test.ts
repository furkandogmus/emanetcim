import { describe, it, expect, vi } from "vitest";
import { Prisma } from "@prisma/client";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { retryOnWriteConflict } from "@/lib/tx-retry";
import { stripComments } from "./helpers/strip-comments";

/**
 * YAZMA CAKISMASI YENIDEN DENENIR.
 *
 * Gercek veritabaninda olculdu (2026-09-02): rezervasyon olusturma
 * `Serializable` izolasyon + `FOR UPDATE` ile korunuyor ve kapasiteyi DOGRU
 * koruyor -- ama cakisan islemler yeniden DENENMIYORDU. Ayni slota alti es
 * zamanli istek:
 *
 *     ONCE : basarili 1, red 5 ("write conflict or deadlock"), defter 10/50
 *     SONRA: basarili 5, red 1 ("0 bags available"),           defter 50/50
 *
 * Yani kapasite hicbir zaman asilmiyordu -- korunan buydu -- ama YER VARKEN
 * bes misafir "beklenmeyen hata" aliyordu. Popüler bir dukkanda ayni saate
 * ayni anda birkac kisi rezervasyon yaptiginda gorulecek sey buydu: biri
 * gecer, digerleri hata gorur.
 *
 * `Serializable` bu hatayi URETMEK uzere tasarlanmistir; Postgres'in kendi
 * mesaji "please retry your transaction" diyor. Eksik olan tarafi cagirandi.
 *
 * Bu sinif KOD OKUYARAK bulunamazdi: her satir dogru, izolasyon dogru, kilit
 * dogru. Yalnizca es zamanli calistirinca ortaya cikti.
 */

function cakisma(): Prisma.PrismaClientKnownRequestError {
  return new Prisma.PrismaClientKnownRequestError("write conflict", {
    code: "P2034",
    clientVersion: "test",
  });
}

describe("retryOnWriteConflict", () => {
  it("cakismada yeniden dener ve sonunda basarili olur", async () => {
    let n = 0;
    const sonuc = await retryOnWriteConflict(
      async () => {
        n++;
        if (n < 3) throw cakisma();
        return "tamam";
      },
      { baseDelayMs: 1 },
    );
    expect(sonuc).toBe("tamam");
    expect(n).toBe(3);
  });

  it("IS REDLERINI yeniden DENEMEZ", async () => {
    /*
      Kapasite asimi, gecersiz tarih, prelaunch dukkan: hepsi deterministik.
      Yeniden denemek ayni cevabi daha yavas almaktan baska bir sey yapmaz ve
      gercek bir hatayi gizleyebilir.
    */
    let n = 0;
    await expect(
      retryOnWriteConflict(async () => {
        n++;
        throw new Error("Slot has only 0 bags available");
      }, { baseDelayMs: 1 }),
    ).rejects.toThrow("0 bags available");
    expect(n, "is redleri tek denemede birakilmali").toBe(1);
  });

  it("deneme hakki bitince cakismayi FIRLATIR", async () => {
    let n = 0;
    await expect(
      retryOnWriteConflict(async () => {
        n++;
        throw cakisma();
      }, { attempts: 3, baseDelayMs: 1 }),
    ).rejects.toMatchObject({ code: "P2034" });
    expect(n).toBe(3);
  });

  it("varsayilan bes deneme", async () => {
    let n = 0;
    await expect(
      retryOnWriteConflict(async () => { n++; throw cakisma(); }, { baseDelayMs: 1 }),
    ).rejects.toBeDefined();
    // Uc denemeyle olculdu: alti es zamanli istekten ikisi tukeniyordu.
    expect(n).toBe(5);
  });

  it("bekleme JITTER tasiyor -- cakisanlar ayni anda uyanmasin", async () => {
    const src = stripComments(readFileSync(join(process.cwd(), "src/lib/tx-retry.ts"), "utf-8"));
    expect(src).toMatch(/Math\.random\(\)/);
  });
});

describe("Serializable islemler retry ile sarili", () => {
  it.each([
    ["src/services/booking/create.ts", 2],
    ["src/services/booking/lifecycle.ts", 1],
  ])("%s icindeki %i islem sarili", (rel, adet) => {
    const src = stripComments(readFileSync(join(process.cwd(), rel), "utf-8"));
    const sarili = (src.match(/retryOnWriteConflict\(\(\) => prisma\.\$transaction\(/g) ?? []).length;
    const serializable = (src.match(/TransactionIsolationLevel\.Serializable/g) ?? []).length;
    expect(sarili, `${rel}: sarili islem sayisi`).toBe(adet);
    expect(serializable, `${rel}: Serializable islem sayisi`).toBe(adet);
  });
});
