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
  | 'SHOP_PRELAUNCH';

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
 * Dukkan bir TALEP TESTI noktasi: aramada gorunur ama rezervasyon almaz.
 *
 * NEDEN SUNUCUDA: arayuz zaten prelaunch noktalarinda rezervasyon dugmesi yerine
 * "acilinca haber ver" gosteriyor, ama arayuz TEK basina yeterli degil -- mobil
 * uc, dogrudan API cagrisi ya da eski bir istemci ayni yolu deneyebilir. Bu kapi
 * son savunmadir: hicbir yoldan, olmayan bir noktaya onaylanmis rezervasyon
 * uretilemez. Cunku o rezervasyonun bedelini valiziyle bos adrese giden misafir
 * oder.
 */
export class BookingShopPrelaunchError extends BookingRejectedError {
  constructor(message = 'Bu nokta henuz hizmete acilmadi.') {
    super(message, 'SHOP_PRELAUNCH');
  }
}
