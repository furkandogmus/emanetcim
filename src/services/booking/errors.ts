/**
 * Rezervasyon olusturmanin REDDETME sebepleri.
 *
 * NEDEN TIPLI (2026-08-25): `createInitialBooking` gecersiz tarih araligi icin
 * `new Error('Gecersiz rezervasyon tarihleri.')` firlatiyordu — TURKCE, tipsiz bir
 * cumle. Iki sonucu vardi:
 *
 *   1. Cagiran onu diger hatalardan AYIRT EDEMIYORDU. Web `catch` blogu
 *      `Errors.generic`e dusuruyordu; mobil `checkout/intent` ise hic yakalamiyordu,
 *      yani gecersiz tarihle gelen bir mobil istek **HTTP 500** aliyordu.
 *   2. Metnin kendisi kullaniciya sizabilirdi (`raw-error-copy` mandalinin kovaladigi
 *      sinif).
 *
 * Artik her sebebin kendi tipi var; tasiyicilar `instanceof` ile kendi hata
 * sozlesmelerine cevirir.
 */

/** Ortak taban — tek bir `catch` ile "bu bir dogrulama reddi" ayirt edilebilsin. */
export class BookingRejectedError extends Error {
  constructor(
    message: string,
    /** Cagiranin eslemede kullandigi sabit kod; metin degil BU tasinir. */
    readonly code: BookingRejectionCode,
  ) {
    super(message);
    this.name = new.target.name;
  }
}

export type BookingRejectionCode =
  | 'CAPACITY_EXCEEDED'
  | 'INVALID_DATES'
  | 'PLATFORM_HOLIDAY'
  | 'PAYMENTS_DISABLED';

/** Dukkan kapasitesi secilen aralikta yetmiyor. */
export class BookingCapacityExceededError extends BookingRejectedError {
  constructor(message: string) {
    super(message, 'CAPACITY_EXCEEDED');
  }
}

/** Tarih araligi izin verilen konaklama penceresinin disinda. */
export class BookingWindowInvalidError extends BookingRejectedError {
  constructor(message = 'Rezervasyon tarihleri geçersiz veya izin verilen sürenin dışında.') {
    super(message, 'INVALID_DATES');
  }
}

/**
 * Aralik bir platform tatiline deniyor.
 *
 * Bu kontrol 2026-08-25'e kadar YALNIZCA web action'indaydi; mobil checkout ucu
 * hic yapmiyordu, yani ayni tarih web'de reddedilirken mobilde kabul ediliyordu.
 */
export class BookingHolidayError extends BookingRejectedError {
  constructor(message = 'Rezervasyon bir platform tatiline denk geliyor.') {
    super(message, 'PLATFORM_HOLIDAY');
  }
}

/**
 * Odeme alimi kapatilmis: `PAYMENTS_ENABLED=false` ya da `payments` bayragi kapali.
 *
 * NEDEN VAR (2026-08-30): admin panelindeki bayrak ekrani ALTI DILDE
 * "PAYMENTS_ENABLED=false ile aninda odeme kapatmasi yapabilirsiniz" diyordu, ama
 * `PAYMENTS_ENABLED` src altinda HIC OKUNMUYORDU -- ne env semasinda ne bir kod
 * yolunda. Yani olay aninda operator degiskeni yazar, servisi yeniden baslatir ve
 * odeme akisi aynen devam ederdi; ustelik "kapattim" sanarak. Var olmayan bir acil
 * durum dugmesi, hic olmayandan tehlikelidir.
 *
 * KAPSAM BILEREK DAR -- yalnizca YENI odeme yukumlulugu acmayi durdurur:
 *   - Check-in DURDURULMAZ. `manual` saglayicida para dukkanda o an aliniyor ve
 *     `check-in.ts` bunun icin `openIntent`/`markCaptured` cagiriyor. Orayi
 *     kapatmak, elinde valizle bekleyen misafiri kapida birakirdi.
 *   - Iade DURDURULMAZ. Bir odeme olayinda iadeleri bloke etmek tam ters yondur.
 * Yani anahtar on kapiyi kapatir, icerideki yukumlulukler normal sekilde kapanir.
 */
export class BookingPaymentsDisabledError extends BookingRejectedError {
  constructor(message = 'Odeme alimi gecici olarak kapali.') {
    super(message, 'PAYMENTS_DISABLED');
  }
}
