import { createHmac, timingSafeEqual } from "node:crypto";
import { SignJWT, jwtVerify } from "jose";
import { JWT_AUDIENCE, JWT_ISSUER, hasForeignClaims } from "@/lib/jwt-audience";

export type WalletKind = "apple" | "google";

/** Uygulama / web sayfasi bagi hemen acilir; kisa omur sizan bagin degerini dusurur. */
export const WALLET_LINK_TTL_SECONDS = 15 * 60;

function rawSecret(): string {
  const s = process.env.AUTH_SECRET || process.env.NEXTAUTH_SECRET;
  if (!s?.trim()) throw new Error("AUTH_SECRET is required for wallet tokens");
  return s;
}

/**
 * Rezervasyon kimligi URL'de tek basina yetki DEGIL (IDOR): bag, sahiplik
 * kontrolunden sonra imzalanir ve suresi dolar. `walletBookingId` adi QR
 * token'inin `bookingId` alaniyla karismasin diye ayri.
 */
export async function signWalletLinkToken(
  bookingId: string,
  kind: WalletKind,
  expiresAt: Date = new Date(Date.now() + WALLET_LINK_TTL_SECONDS * 1000),
): Promise<{ token: string; expiresAt: Date }> {
  const exp = Math.floor(expiresAt.getTime() / 1000);
  const token = await new SignJWT({ walletBookingId: bookingId, walletKind: kind })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuer(JWT_ISSUER)
    .setAudience(JWT_AUDIENCE.wallet)
    .setIssuedAt()
    .setExpirationTime(exp)
    .sign(new TextEncoder().encode(rawSecret()));
  return { token, expiresAt: new Date(exp * 1000) };
}

export async function verifyWalletLinkToken(token: string, kind: WalletKind): Promise<string | null> {
  try {
    const { payload } = await jwtVerify(token, new TextEncoder().encode(rawSecret()), {
      issuer: JWT_ISSUER,
      audience: JWT_AUDIENCE.wallet,
    });
    if (hasForeignClaims(payload as Record<string, unknown>, ["type", "tv", "sub", "guestId", "shopId", "bookingId", "email", "posterShopId"])) {
      return null;
    }
    const p = payload as { walletBookingId?: unknown; walletKind?: unknown };
    if (p.walletKind !== kind) return null;
    return typeof p.walletBookingId === "string" && p.walletBookingId ? p.walletBookingId : null;
  } catch {
    return null;
  }
}

/**
 * PassKit web servisinin kart basina sifresi (`authenticationToken`). Saklanmaz:
 * seri numarasindan turetilir, cihaz her istekte geri yollar. Sir degisirse
 * verilmis kartlar guncelleme alamaz (ops/SECRETS.md); ayri sir AUTH_SECRET
 * rotasyonunu kartlardan ayirir.
 */
export function passAuthenticationToken(serialNumber: string): string {
  const secret = process.env.WALLET_PASS_AUTH_SECRET?.trim() || rawSecret();
  const key = createHmac("sha256", secret).update("bagajpark:wallet-pass-auth").digest();
  return createHmac("sha256", key).update(serialNumber).digest("base64url");
}

/** `Authorization: ApplePass <token>` basligini dogrular. */
export function verifyPassAuthorization(header: string | null, serialNumber: string): boolean {
  const m = /^ApplePass\s+(\S+)$/.exec(header ?? "");
  if (!m) return false;
  const given = Buffer.from(m[1]);
  const expected = Buffer.from(passAuthenticationToken(serialNumber));
  return given.length === expected.length && timingSafeEqual(given, expected);
}
