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
  /** Rezervasyon check-out zamanı (IMPROVEMENT-01: dinamik token süresi için) */
  checkOutTime?: string;
};

export async function createQrToken(payload: QrPayload): Promise<string> {
  // IMPROVEMENT-01: Checkout + 24 saat buffer; yoksa 72 saat
  const checkOutMs = payload.checkOutTime
    ? new Date(payload.checkOutTime).getTime()
    : 0;
  const minExpiry = Date.now() + 48 * 60 * 60 * 1000;
  const targetExpiry = Math.max(
    checkOutMs + 24 * 60 * 60 * 1000,
    minExpiry
  );
  const expirySeconds = Math.ceil((targetExpiry - Date.now()) / 1000);

  return new SignJWT({ ...payload })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${expirySeconds}s`)
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
