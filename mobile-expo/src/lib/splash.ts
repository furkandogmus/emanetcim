import * as SplashScreen from "expo-splash-screen";

import { installedBinaryVersion, isBelowMinVersion } from "@/lib/app-update";

/**
 * 0.3.4 ikilisinden itibaren yerel acilis ekrani yalnizca zemin rengi; oncekilerde logo
 * var ve degistirmek yeni ikili ister. Acilis animasyonu buna gore bostan ya da logodan baslar.
 */
export const BLANK_SPLASH_FROM = "0.3.4";

export function nativeSplashIsBlank(version: string | null = installedBinaryVersion()): boolean {
  return version != null && !isBelowMinVersion(version, BLANK_SPLASH_FROM);
}

export function hideSplash(): void {
  void SplashScreen.hideAsync().catch(() => undefined);
}
