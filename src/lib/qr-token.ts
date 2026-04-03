import { SignJWT, jwtVerify } from "jose";

const getSecret = () => {
  const s = process.env.AUTH_SECRET || process.env.NEXTAUTH_SECRET;
  if (!s) throw new Error("AUTH_SECRET is required for QR tokens");
  return new TextEncoder().encode(s);
};

export type QrPayload = {
  bookingId: string;
  guestId: string;
  shopId: string;
};

export async function createQrToken(payload: QrPayload): Promise<string> {
  return new SignJWT({ ...payload })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("48h")
    .sign(getSecret());
}

export async function verifyQrToken(token: string): Promise<QrPayload | null> {
  try {
    const { payload } = await jwtVerify(token, getSecret());
    const bookingId = String(payload.bookingId || "");
    const guestId = String(payload.guestId || "");
    const shopId = String(payload.shopId || "");
    if (!bookingId || !guestId || !shopId) return null;
    return { bookingId, guestId, shopId };
  } catch {
    return null;
  }
}
