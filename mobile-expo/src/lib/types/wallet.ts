/** `GET /bookings/[id]/wallet?kind=` yaniti: tarayicida acilan kisa omurlu bag. */
export type WalletLink = { kind: "apple" | "google"; url: string; expiresAt: string };
