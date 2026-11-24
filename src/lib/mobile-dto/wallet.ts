/** `GET /api/mobile/bookings/[id]/wallet`: Wallet'a ekleme bagi (kisa omurlu, tarayicida acilir). */
export function toMobileWalletLink(kind: "apple" | "google", url: string, expiresAt: Date) {
  return { kind, url, expiresAt: expiresAt.toISOString() };
}
