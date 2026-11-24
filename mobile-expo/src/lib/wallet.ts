import type { AppConfig } from "./types";

export type WalletKind = "apple" | "google";

/** Sunucunun kart verdigi durumlar (`WalletPassService` ISSUABLE_STATUSES ile ayni). */
export const WALLET_STATUSES: ReadonlySet<string> = new Set(["APPROVED", "PAID", "CHECKED_IN", "WAITING_APPROVAL"]);

/**
 * Bu cihazda hangi cuzdan dugmesi: iOS -> Apple, Android -> Google, yalnizca
 * sunucu o tarafi acik bildiriyorsa ve durum kart verilebilir ise (yoksa uc 409). Alan yoksa (eski sunucu) dugme yok.
 */
export function walletKindFor(
  config: Pick<AppConfig, "walletApple" | "walletGoogle"> | undefined,
  os: string,
  status: string,
): WalletKind | null {
  if (!WALLET_STATUSES.has(status)) return null;
  if (os === "ios" && config?.walletApple === true) return "apple";
  if (os === "android" && config?.walletGoogle === true) return "google";
  return null;
}
