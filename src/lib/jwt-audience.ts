/**
 * Token AILELERI ve aralarindaki sinir.
 *
 * NEDEN VAR (2026-08-31'de olculdu): projede HS256 ile imzalanan UC ayri token
 * ailesi var ve ucu de AYNI sirri kullaniyor (`AUTH_SECRET`):
 *
 *   1. mobil oturum   — `src/lib/mobile-auth.ts`      `{ sub, role, type, tv }`
 *   2. QR / mühür     — `src/lib/qr-token.ts`         `{ bookingId, guestId, shopId }`
 *   3. misafir sorgu  — `src/lib/guest-lookup-token.ts` `{ bookingId, email }`
 *
 * Ayni sirla imzalanan token'lar arasinda imza HICBIR SEY ayirt etmez; ayrimi
 * yalnizca dogrulayan tarafin alan kontrolleri yapar. Bugun sansimiz yaver
 * gidiyor -- uc govde birbirinin gerektirdigi alanlari tasimiyor. Ama bu bir
 * TESADUF: birine `email` ya da `bookingId` eklendigi gun, o token digerinin
 * kapisini acar. Somut ornek: QR token'i misafirin ELINDE ve ekraninda; ona bir
 * gun `email` eklenirse `guest-cancel` onu kabul eder ve rezervasyon iptali
 * icin yeterli olur.
 *
 * Depo acik kaynak: saldirgan bu govde semalarini tahmin etmek zorunda degil,
 * okuyor. O yuzden ayrim ACIK olmali.
 *
 * IKI KATMAN:
 *
 *   a) `aud` — yeni uretilen her token ailesinin adini tasir. Dogrulama
 *      tarafi, `aud` VARSA eslesmesini sart kosar.
 *   b) Govde KATILIGI — `aud` tasimayan eski token'lar icin: her dogrulayici,
 *      diger ailelerin ayirt edici alanlarini TASIYAN bir token'i reddeder.
 *
 * `aud` neden hemen ZORUNLU degil: QR token'lari veritabaninda saklaniyor
 * (`Booking.qrCodeToken`), misafirin e-postasinda ve ekraninda duruyor, omru
 * check-out + 24 saat. Dogrulamada `aud`'u bugun zorunlu kilmak, o an ACIK olan
 * rezervasyonlarin QR'larini calismaz hale getirirdi -- esnaf tarar, gecersiz
 * der. (b) katmani o boslugu zaten kapatiyor. Yayindaki en uzun omurlu QR
 * dustukten sonra `requireAudience` tek satirla zorunlu yapilabilir.
 */

export const JWT_AUDIENCE = {
  mobile: "bagajpark:mobile",
  qr: "bagajpark:qr",
  guestLookup: "bagajpark:guest-lookup",
} as const;

export type JwtAudience = (typeof JWT_AUDIENCE)[keyof typeof JWT_AUDIENCE];

export const JWT_ISSUER = "bagajpark";

/**
 * `aud` TASIYORSA beklenen degere esit olmali; tasimiyorsa (gecis donemi
 * token'i) gecer. Dizi de olabilir -- JWT `aud` alani coklu deger tanir.
 */
export function audienceAllows(
  claim: unknown,
  expected: JwtAudience,
): boolean {
  if (claim === undefined || claim === null) return true;
  if (typeof claim === "string") return claim === expected;
  if (Array.isArray(claim)) return claim.includes(expected);
  return false;
}

/**
 * Bir ailenin ASLA tasimamasi gereken alanlar. Tasiyorsa token baska bir
 * aileye aittir ve reddedilir -- `aud` olmasa bile.
 */
export function hasForeignClaims(
  payload: Record<string, unknown>,
  forbidden: readonly string[],
): boolean {
  return forbidden.some((k) => payload[k] !== undefined);
}
