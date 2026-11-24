import type { AppConfig } from "./types";

export type WalletKind = "apple" | "google";

/**
 * Bu cihazda hangi cuzdan dugmesi: iOS -> Apple, Android -> Google, yalnizca
 * sunucu o tarafi acik bildiriyorsa. Alan yoksa (eski sunucu) dugme yok.
 */
export function walletKindFor(config: Pick<AppConfig, "walletApple" | "walletGoogle"> | undefined, os: string): WalletKind | null {
  if (os === "ios" && config?.walletApple === true) return "apple";
  if (os === "android" && config?.walletGoogle === true) return "google";
  return null;
}
