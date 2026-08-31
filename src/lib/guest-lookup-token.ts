import { SignJWT, jwtVerify } from "jose";
import {
  JWT_AUDIENCE,
  JWT_ISSUER,
  audienceAllows,
  hasForeignClaims,
} from "@/lib/jwt-audience";

/**
 * Misafir rezervasyon arama/iptal token'ının imza sırrı.
 *
 * NEDEN AYRI DOSYA (P2-6, 2026-08-24): üç uç (`lookup`, `lookup/me`,
 * `guest-cancel`) sırrı kendi içinde şöyle türetiyordu:
 *
 *   process.env.AUTH_SECRET || "bagajpark-guest-management-secret"
 *
 * Yani `AUTH_SECRET` tanımsızsa üç uç da **repoda yazılı, herkesin okuyabildiği**
 * bir sırra düşüyordu. O sırla üretilen bir token `guest-cancel`'da kabul edilir;
 * saldırgan yalnızca `bookingId` + `email` alanlarını doldurup başkasının
 * rezervasyonunu iptal edebilir. Üç kopya olması ayrıca sessiz sapma riski:
 * biri düzeltilip diğerleri unutulabilirdi.
 *
 * `src/lib/qr-token.ts` ve `src/lib/mobile-auth.ts` bu sınıfı zaten doğru
 * çözmüştü (yoksa at). Bu dosya aynı sözleşmeyi misafir token'ına getiriyor:
 * fallback yok, eksikse **hata**. `requireProdSecrets()` prod açılışında zaten
 * `AUTH_SECRET`'i zorunlu kılıyor; buradaki kontrol geliştirme/test ortamında
 * sırrın sessizce sabit bir değere düşmesini engelliyor.
 */
export function guestLookupSecret(): Uint8Array {
  const s = process.env.AUTH_SECRET || process.env.NEXTAUTH_SECRET;
  if (!s?.trim()) {
    throw new Error("AUTH_SECRET is required for guest booking lookup tokens");
  }
  return new TextEncoder().encode(s);
}

/**
 * Misafir sorgu token'ının BEARER başlığından doğrulanması.
 *
 * NEDEN ORTAK (2026-08-25'te ölçüldü): aynı 15 satır iki uçta yazılıydı
 * (`bookings/lookup/me`, `bookings/guest-cancel`). Kimlik doğrulama, kopyaların
 * ayrışmasını en pahalıya ödeyeceğimiz yer: bir uç sürüm/`type` kontrolü eklerse
 * diğeri eklemezse, kabul edilen token kümesi iki uçta FARKLI olur.
 *
 * Sır `try` blogunun DIŞINDA okunur: eksik `AUTH_SECRET` bir YAPILANDIRMA
 * hatasıdır ve 500 dönmeli. İçeride kalsaydı "geçersiz veya süresi dolmuş token"
 * (401) diye görünür, gerçek sebep hiçbir yerde yazmazdı.
 */
export type GuestLookupClaims = { bookingId: string; email: string };

/**
 * Token URETIMI ARTIK BURADA (2026-08-31). Onceden `bookings/lookup` ucu
 * `SignJWT`'yi kendi cagiriyordu; dogrulama burada, uretim orada olunca ikisi
 * ayri ayri degistirilebiliyordu. `aud` gibi bir alani yalnizca bir tarafa
 * eklemek sessizce ise yaramayan bir onlem birakir.
 *
 * `setIssuedAt` da eklendi: yoksa token ne zaman verildigi bilinmez ve bir
 * sizinti sonrasi "hangi tarihten oncekiler dusurulsun" sorusu yanitsizdir.
 */
export async function signGuestLookupToken(
  claims: GuestLookupClaims,
): Promise<string> {
  return new SignJWT({ bookingId: claims.bookingId, email: claims.email })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuer(JWT_ISSUER)
    .setAudience(JWT_AUDIENCE.guestLookup)
    .setIssuedAt()
    .setExpirationTime("1h")
    .sign(guestLookupSecret());
}

export type GuestLookupAuth =
  | { ok: true; claims: GuestLookupClaims }
  | { ok: false; code: "missing_token" | "invalid_token" };

export async function authenticateGuestLookup(
  authorizationHeader: string | null,
): Promise<GuestLookupAuth> {
  if (!authorizationHeader?.startsWith("Bearer ")) {
    return { ok: false, code: "missing_token" };
  }
  const token = authorizationHeader.slice(7);
  const secret = guestLookupSecret();

  try {
    const { payload } = await jwtVerify(token, secret);

    /*
      AILE SINIRI (2026-08-31). Bu sir ayni zamanda mobil oturum ve QR
      token'larini da imzaliyor; imza tek basina hangi aileye ait oldugunu
      soylemez. `src/lib/jwt-audience.ts` bunun neden onemli oldugunu anlatiyor.

      `sub`/`type`/`tv`  -> mobil oturum token'i
      `guestId`/`shopId` -> QR token'i
      Bunlardan birini tasiyan bir govde misafir sorgu token'i DEGILDIR.
    */
    if (!audienceAllows(payload.aud, JWT_AUDIENCE.guestLookup)) {
      return { ok: false, code: "invalid_token" };
    }
    if (
      hasForeignClaims(payload as Record<string, unknown>, [
        "type",
        "tv",
        "guestId",
        "shopId",
      ])
    ) {
      return { ok: false, code: "invalid_token" };
    }

    const claims = payload as Partial<GuestLookupClaims>;
    if (typeof claims.bookingId !== "string" || typeof claims.email !== "string") {
      return { ok: false, code: "invalid_token" };
    }
    if (!claims.bookingId || !claims.email) return { ok: false, code: "invalid_token" };
    return { ok: true, claims: { bookingId: claims.bookingId, email: claims.email } };
  } catch {
    return { ok: false, code: "invalid_token" };
  }
}
