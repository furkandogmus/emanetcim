import { SignJWT, jwtVerify } from "jose";
import { JWT_AUDIENCE, JWT_ISSUER, hasForeignClaims } from "@/lib/jwt-audience";

/**
 * Uygulamadan acilan QR afisi bagi. Mobil oturum bir JWT ve tarayiciya
 * tasinamaz; afis sayfasi da yazdirma icin tarayicida acilmak zorunda. Bag
 * yalnizca tek bir dukkanin afisini gosterir (vitrinde zaten herkese acik
 * bilgi: dukkan adi + uygulama QR'i), yine de kisa omurlu: sizan bir bag
 * dakikalar icinde olur.
 */
export const POSTER_LINK_TTL_SECONDS = 15 * 60;

function secret(): Uint8Array {
  const s = process.env.AUTH_SECRET || process.env.NEXTAUTH_SECRET;
  if (!s?.trim()) throw new Error("AUTH_SECRET is required for poster link tokens");
  return new TextEncoder().encode(s);
}

export async function signPosterLinkToken(
  shopId: string,
  now: Date = new Date(),
): Promise<{ token: string; expiresAt: Date }> {
  const iat = Math.floor(now.getTime() / 1000);
  const exp = iat + POSTER_LINK_TTL_SECONDS;
  // Alan adi `posterShopId`: QR token'inin `shopId` alaniyla karismasin.
  const token = await new SignJWT({ posterShopId: shopId })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuer(JWT_ISSUER)
    .setAudience(JWT_AUDIENCE.poster)
    .setIssuedAt(iat)
    .setExpirationTime(exp)
    .sign(secret());
  return { token, expiresAt: new Date(exp * 1000) };
}

/**
 * Gecerliyse dukkan kimligi, degilse null. `aud` ZORUNLU: `audienceAllows`
 * eski token'lar icin bos `aud`'u kabul ediyor; bu aile yeni, eskisi yok.
 */
export async function verifyPosterLinkToken(token: string): Promise<string | null> {
  const key = secret();
  try {
    const { payload } = await jwtVerify(token, key, {
      issuer: JWT_ISSUER,
      audience: JWT_AUDIENCE.poster,
    });
    if (hasForeignClaims(payload as Record<string, unknown>, ["type", "tv", "sub", "guestId", "shopId", "bookingId", "email"])) {
      return null;
    }
    const shopId = (payload as { posterShopId?: unknown }).posterShopId;
    return typeof shopId === "string" && shopId ? shopId : null;
  } catch {
    return null;
  }
}
