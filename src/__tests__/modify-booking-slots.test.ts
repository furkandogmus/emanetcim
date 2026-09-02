import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { stripComments } from "./helpers/strip-comments";

/**
 * REZERVASYON DEGISINCE SLOT DEFTERI DE TASINIR.
 *
 * Olculdu (2026-09-02): `modifyBooking` tarihleri ve valiz sayilarini
 * `Booking` uzerinde guncelliyor, `ReservationSlot` satirlarina hic
 * dokunmuyordu. Satirlar ESKI slotlara bagli kaliyor ve iki muhasebe birden
 * bozuluyordu:
 *
 *   - Eski saatte HAYALET rezervasyon: kimse gelmeyecek ama defter o saati
 *     dolu sayiyor; kapasite bosa yaniyor.
 *   - Yeni saatte GORUNMEZ rezervasyon: slot defterinde yok (slotlar eskiye
 *     bagli), eski-yol sayimina da girmiyor cunku o sayim slotu OLMAYAN
 *     kayitlari suzuyor (`reservationSlots: { none: {} }`). Dukkan o saati bir
 *     kez daha satabiliyor; misafir valiziyle gelince yer yok.
 *
 * `assertCapacityTx` bunu yakalayamaz: o `Booking` tablosunu sayar, slot
 * defterini degil. Iki ayri kapasite muhasebesi var ve degistirme yolu yanlis
 * olanina bakiyordu.
 *
 * Ayni sinifin kardesi `applyBagRevision`ti (ayni gun duzeltildi): orada valiz
 * sayisi degisiyordu, burada tarih de degisiyor -- yani slot BAGLARI tamamen
 * gecersiz kaliyordu.
 */

const kaynak = stripComments(
  readFileSync(join(process.cwd(), "src/services/booking/lifecycle.ts"), "utf-8"),
);

/** `modifyBooking` govdesi -- ayni dosyadaki digger fonksiyonlar karismasin. */
function modifyGovdesi(): string {
  const bas = kaynak.indexOf("export async function modifyBooking");
  expect(bas, "modifyBooking bulunamadi").toBeGreaterThan(-1);
  const kalan = kaynak.slice(bas + 10);
  const son = kalan.indexOf("\nexport ");
  return son === -1 ? kalan : kalan.slice(0, son);
}

describe("modifyBooking slot defterini tasiyor", () => {
  const govde = modifyGovdesi();

  it("eski slotlar serbest birakiliyor", () => {
    expect(govde).toContain("releaseSlots(tx, bookingId)");
  });

  it("yeni tarih icin yeniden rezerve ediliyor", () => {
    expect(govde).toContain("reserveSlots(");
    expect(govde).toMatch(/reservationSlot\.createMany/);
  });

  it("sira ONCE birak SONRA rezerve et", () => {
    /*
      Ters sirada rezervasyonun KENDI payi sayima girer ve her degisiklik
      kapasite asimi olarak reddedilirdi.
    */
    expect(govde.indexOf("releaseSlots")).toBeLessThan(govde.indexOf("reserveSlots("));
  });

  it("slotu OLMAYAN rezervasyon bu yoldan etkilenmiyor", () => {
    // Eski kayitlarin slot satiri yok; onlarda yalnizca `Booking` guncellenir.
    expect(govde).toMatch(/reservationSlot\.count\(\{ where: \{ bookingId \} \}\)/);
    expect(govde).toMatch(/if \(slotluMu > 0\)/);
  });

  it("kaydedilen zaman slot sinirlarina yuvarlanmis olan", () => {
    // Istenen zaman ile kaplanan slotlar ayrisirsa rezervasyonun saati ile
    // yer kaplamasi birbirini tutmaz.
    expect(govde).toContain("kayitliGiris = yeni.checkInTime");
    expect(govde).toContain("kayitliCikis = yeni.checkOutTime");
    expect(govde).toMatch(/checkInTime: kayitliGiris/);
  });

  it("hepsi TEK islemde", () => {
    expect(govde).toMatch(/prisma\.\$transaction\(/);
    expect(govde).toMatch(/isolationLevel: Prisma\.TransactionIsolationLevel\.Serializable/);
  });
});

describe("slot kapasitesi dolarsa misafir ne goruyor", () => {
  it("SlotAvailabilityError KAPASITE reddine cevriliyor", () => {
    /*
      Ayri bir hata turu oldugu icin ayrica yakalanmali; yoksa misafir
      "beklenmeyen bir hata" gorur ve neyi degistirecegini bilemez.
    */
    expect(kaynak).toContain("error instanceof SlotAvailabilityError");
    const parca = kaynak.slice(kaynak.indexOf("error instanceof SlotAvailabilityError"));
    expect(parca.slice(0, 200)).toContain("'CAPACITY'");
  });
});
