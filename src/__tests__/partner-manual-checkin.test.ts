import { describe, it, expect } from "vitest";
import fs from "node:fs";
import { extractBookingRef } from "@/components/partner/QRScanner";

/**
 * ELLE REZERVASYON GİRİŞİ — bagaj teslimi kameraya bağlı olamaz.
 *
 * NEDEN (2026-08-31'de esnaf panelinde gezilerek bulundu): "Yeni valiz teslim
 * al" tek bir yol açıyordu, kamera. Kamera izni reddedilmişse, webcam'i olmayan
 * bir masaüstünde ya da misafirin telefonu bittiği için gösterecek QR yoksa
 * ekranda "Kamerayı başlat"tan başka hiçbir şey yoktu — esnaf valizi HİÇ teslim
 * alamıyordu. Hata mesajı da yoktu; akış öylece bitiyordu.
 */
describe("extractBookingRef", () => {
  const ID = "3f2504e0-4f89-41d3-9a0c-0305e82c3301";

  it("kimligin kendisini kabul eder", () => {
    expect(extractBookingRef(ID)).toBe(ID);
    expect(extractBookingRef(`  ${ID}  `)).toBe(ID);
  });

  it("misafirin ekranindaki BAGLANTIYI da kabul eder", () => {
    // Esnafin yapistiracagi sey pratikte bu. Bagi reddetmek, kullaniciyi elle
    // kirpmaya zorlamak olurdu -- ve bu ekran zaten isler ters gittiginde
    // aciliyor.
    expect(extractBookingRef(`https://bagajpark.com/tr/bookings/${ID}`)).toBe(ID);
    expect(extractBookingRef(`https://bagajpark.com/tr/partner?booking=${ID}`)).toBe(ID);
  });

  it("misafirin ekranindaki KISA KODU bozmadan gecirir", () => {
    /**
     * Misafirin rezervasyon ekraninda tam kimlik HIC yazmiyor; orada
     * `booking.id.slice(0, 8).toUpperCase()` var. Esnaf onu okuyup yaziyor, yani
     * kisa kod sunucuya OLDUGU GIBI ulasmali -- sunucu onek eslesmesi yapiyor
     * (`getPartnerBookingPreviewAction`, sahiplige daraltilmis).
     */
    expect(extractBookingRef("AA4249AD")).toBe("AA4249AD");
    expect(extractBookingRef("  aa4249ad ")).toBe("aa4249ad");
  });

  it("kimlik icermeyen metni OLDUGU GIBI birakir", () => {
    // Sunucu imzali QR jetonunu da cozebiliyor; burada kirpmak onu bozardi.
    const token = "eyJhbGciOiJIUzI1NiJ9.eyJib29raW5nSWQiOiJ4In0.sig";
    expect(extractBookingRef(token)).toBe(token);
  });
});

describe("QR ekrani", () => {
  it("elle giris formu KOSULSUZ cizilir", () => {
    const src = fs.readFileSync("src/components/partner/QRScanner.tsx", "utf8");
    const formIndex = src.indexOf("partner-manual-booking");
    expect(formIndex, "elle giris alani yok").toBeGreaterThan(-1);

    /**
     * Form, kamera hatasi dalinin (`phase === "error"`) ICINDE olmamali:
     * kullanici kamerayi hic denemek istemeyebilir ya da kamera "calisiyor"
     * gorunup hicbir seyi okumuyor olabilir. Ikisi de hata dali degildir.
     */
    const errorBranch = src.indexOf('phase === "needTap" || phase === "error"');
    expect(errorBranch, "hata dali bulunamadi").toBeGreaterThan(-1);
    expect(formIndex, "elle giris yalnizca kamera hatasinda gorunuyor").toBeLessThan(
      errorBranch,
    );
  });
});
