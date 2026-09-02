import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { stripComments } from "./helpers/strip-comments";

/**
 * VALIZI RAFTA OLAN MISAFIRIN HESABI SILINEMEZ -- YASAKLI OLSA BILE.
 *
 * Olculdu (2026-09-02): hesap silme iki dala ayriliyor ve koruma yalnizca
 * birinde vardi.
 *
 *   NORMAL kullanici : aktif rezervasyon varsa silme ENGELLENIYOR
 *   YASAKLI kullanici: acik rezervasyonlar zorla iptal edilir; iptal
 *                      edilemeyenler icin YALNIZCA uyari yazilip silmeye
 *                      DEVAM ediliyordu
 *
 * Ikinci dal tam da en tehlikeli durumda kiriliyor: `cancelBooking`
 * `CHECKED_IN` durumunu BILEREK reddediyor, cunku valiz o anda fiziksel olarak
 * dukkanin rafinda ve iptal onu ortadan kaldirmaz. Yani zorla iptalin
 * basarisiz oldugu tek durum, silmenin en zararli oldugu durumla ayni.
 *
 * Silindiginde: `Booking.guestId` bosalir, `guest` iliskisi kaybolur, hesapli
 * misafirde `guestEmail`/`guestPhone` zaten null -- esnaf valizi kime teslim
 * edecegini ve kime haber verecegini bilemez.
 *
 * Yasaklamak, valizi dukkandan kaldirmiyor.
 */

const kaynak = stripComments(
  readFileSync(join(process.cwd(), "src/actions/admin-management.ts"), "utf-8"),
);

/** Yasakli dalinin govdesi. */
function yasakliDali(): string {
  const bas = kaynak.indexOf("if (userToDelete.isBanned)");
  expect(bas, "yasakli dali bulunamadi").toBeGreaterThan(-1);
  return kaynak.slice(bas, kaynak.indexOf("} else {", bas));
}

describe("hesap silme aktif rezervasyonu koruyor", () => {
  it("yasakli dalinda kapatilamayan rezervasyon silmeyi DURDURUYOR", () => {
    const dal = yasakliDali();
    expect(dal).toContain("summary.failed > 0");
    // Uyari yetmez: silme akisindan CIKILMALI.
    expect(dal).toMatch(/return \{ ok: false, error: DELETE_USER_HAS_ACTIVE_BOOKING_CODE \}/);
  });

  it("normal dalindaki koruma yerinde duruyor", () => {
    expect(kaynak).toContain("admin_delete_user_blocked_active_booking");
    expect(kaynak).toContain("DELETE_USER_HAS_ACTIVE_BOOKING_CODE");
  });

  it("iki dal AYNI sonucu donduruyor", () => {
    /*
      Ayni durum (silinemez, acik rezervasyon var) iki dalda farkli kod
      donseydi, admin arayuzu birinde anlamli mesaj, digerinde genel hata
      gosterirdi.
    */
    const adet = (kaynak.match(/DELETE_USER_HAS_ACTIVE_BOOKING_CODE/g) ?? []).length;
    // tanim + normal dal + yasakli dal
    expect(adet).toBeGreaterThanOrEqual(3);
  });

  it("CHECKED_IN hala iptal edilemez -- korumanin dayanagi bu", () => {
    /*
      Bu test dusuyorsa `cancelBooking` artik CHECKED_IN'i kabul ediyor
      demektir; o zaman yukaridaki koruma da gozden gecirilmeli.
    */
    const lifecycle = stripComments(
      readFileSync(join(process.cwd(), "src/services/booking/lifecycle.ts"), "utf-8"),
    );
    expect(lifecycle).toMatch(/booking\.status === 'CHECKED_IN'/);
  });
});
