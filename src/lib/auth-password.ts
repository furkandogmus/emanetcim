import bcrypt from "bcryptjs";

const ROUNDS = 12;

/**
 * PAROLA TABANI — tek yer.
 *
 * NEDEN VAR (2026-08-31'de olculdu): alt sinir DORT ayri semada elle yaziliydi
 * ve uc farkli deger tasiyordu:
 *
 *   `actions/register.ts`  misafir kaydi        -> `min(8)`
 *   `actions/register.ts`  ESNAF kaydi          -> `min(6)`
 *   `api/mobile/auth/register`                  -> `min(6)`
 *   `services/auth/password-reset.ts`           -> 8
 *
 * Iki sonucu vardi:
 *
 *   1. **En yetkili rol en zayif tabani aliyordu.** Esnaf, misafirin adini,
 *      telefonunu ve e-postasini goruyor; check-in/check-out yapiyor; muhur
 *      envanterini yonetiyor. Misafirden DAHA GUCLU bir parola istenmesi
 *      gerekirken daha zayifi isteniyordu.
 *   2. **Ayni hesap, hangi ekrandan gelindigine gore farkli kural goruyordu.**
 *      Mobilden alti karakterle kaydolan bir kullanici, parolasini
 *      sifirlamak istediginde sekiz karakter dayatmasiyla karsilasiyordu.
 *
 * Sayi burada; semalar bunu ithal eder. `auth-endpoint-guards` mandali kendi
 * sayisini yazan bir sema eklenmesini yakaliyor.
 *
 * MEVCUT PAROLALARI ETKILEMEZ: bu sinir yalnizca YENI parola belirlenirken
 * uygulanir. Girisin kendisi (`auth.config.ts`, `auth/session`) `min(1)`
 * tutuyor -- bilerek: eski bir parolayi uzunluguna bakip reddetmek, kullaniciyi
 * sebebini soyleyemeden disarida birakir.
 */
export const MIN_PASSWORD_LENGTH = 8;
export const MAX_PASSWORD_LENGTH = 128;

export async function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, ROUNDS);
}

export async function verifyPassword(plain: string, hash: string): Promise<boolean> {
  return bcrypt.compare(plain, hash);
}
