import { cookies } from "next/headers";
import { randomUUID } from "node:crypto";

/**
 * Anonim ziyaretci kimligi — talep testi sayaclarinin dedupe anahtari.
 *
 * NE DEGIL: kisiyi tanimlayan, profil kuran ya da baska bir yerde kullanilan bir
 * kimlik degil. Tek isi "bu tarayici bu noktayi zaten istedi mi" sorusunu
 * cevaplamak. Icinde rastgele bir UUID'den baska bir sey yok.
 *
 * NEDEN SUNUCUDA VE HTTP-ONLY: dedupe istemciye birakilamaz -- `localStorage`
 * ile tutulan bir "zaten tikladim" isareti konsoldan silinebilir ve sayac
 * sisirilebilir. Karar tam da bu sayiya bakilarak veriliyor (bir sehirde esnaf
 * aramak on binlerce dolarlik bir taahhut), o yuzden kontrol veritabaninda:
 * `PrelaunchWant.@@unique([shopId, anonId])`.
 *
 * NEDEN CEREZ ONAYI GEREKTIRMEZ: islevsel bir cerez -- kullanicinin talep ettigi
 * bir islevin (istegin bir kez sayilmasi) calismasi icin zorunlu, izleme veya
 * reklam amaci yok, ucuncu tarafa gitmiyor.
 */
const COOKIE_NAME = "bp_anon";
/** Bir yil: talep testi aylar suren bir olcum, kimlik o sureyi asmali. */
const MAX_AGE_SECONDS = 60 * 60 * 24 * 365;

/**
 * Kimligi okur, yoksa uretip cereze yazar.
 *
 * YALNIZCA sunucu eyleminden / route handler'dan cagrilabilir: Next.js render
 * sirasinda cerez YAZMAYA izin vermez. Okuma her yerde serbest, o yuzden salt
 * okuma icin `readAnonVisitorId` var.
 */
export async function ensureAnonVisitorId(): Promise<string> {
  const jar = await cookies();
  const existing = jar.get(COOKIE_NAME)?.value;
  if (existing && existing.length >= 8) return existing;

  const id = randomUUID();
  jar.set(COOKIE_NAME, id, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: MAX_AGE_SECONDS,
  });
  return id;
}

/** Salt okuma — render sirasinda guvenli. Kimlik yoksa `null`. */
export async function readAnonVisitorId(): Promise<string | null> {
  const jar = await cookies();
  return jar.get(COOKIE_NAME)?.value ?? null;
}
