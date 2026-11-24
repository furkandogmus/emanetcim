import { requireOptionalNativeModule } from "expo";
import * as SecureStore from "expo-secure-store";

import type { Role } from "./types";

/**
 * Uygulama kilidi (biyometri, yoksa cihaz kodu). Yonetici icin varsayilan acik, esnaf icin
 * istege bagli, misafir hic kilitlenmez. Cihazda biyometri de kod da kayitli degilse kilit
 * yoktur ve ayar gosterilmez: kimsenin acamayacagi bir kilit kurulmaz.
 *
 * Yerel modul 0.3.6 ile geldi; eski ikiliye giden OTA'da modul yoksa kilit sessizce kapali.
 */
export const LOCK_AFTER_BACKGROUND_MS = 5 * 60 * 1000;

type LocalAuth = typeof import("expo-local-authentication");

function localAuth(): LocalAuth | null {
  if (!requireOptionalNativeModule("ExpoLocalAuthentication")) return null;
  // Modul yalniz varsa yuklenir: dogrudan import eski ikilide acilista firlatir.
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  return require("expo-local-authentication") as LocalAuth;
}

export function lockDefault(role: Role): boolean {
  return role === "ADMIN";
}

/** Kullanici tercihi yoksa rol varsayilani; misafir her zaman kilitsiz. */
export function lockEnabledFor(role: Role, pref: boolean | null): boolean {
  if (role === "GUEST") return false;
  return pref ?? lockDefault(role);
}

export function lockOnResume(backgroundedAt: number | null, now: number): boolean {
  return backgroundedAt !== null && now - backgroundedAt > LOCK_AFTER_BACKGROUND_MS;
}

const prefKey = (userId: string) => `app_lock_${userId.replace(/[^A-Za-z0-9._-]/g, "_")}`;

export async function readLockPref(userId: string): Promise<boolean | null> {
  const v = await SecureStore.getItemAsync(prefKey(userId)).catch(() => null);
  return v === "on" ? true : v === "off" ? false : null;
}

export async function writeLockPref(userId: string, on: boolean) {
  await SecureStore.setItemAsync(prefKey(userId), on ? "on" : "off").catch(() => undefined);
}

/** Biyometri ya da cihaz kodu kayitli mi; modul yoksa ya da hata verirse hayir. */
export async function deviceCanLock(): Promise<boolean> {
  const la = localAuth();
  if (!la) return false;
  try {
    return (await la.getEnrolledLevelAsync()) >= la.SecurityLevel.SECRET;
  } catch {
    return false;
  }
}

/** Biyometri, olmazsa cihaz kodu. Iptal ya da hata `false`. */
export async function authenticate(prompt: string, cancelLabel: string): Promise<boolean> {
  const la = localAuth();
  if (!la) return true;
  try {
    const r = await la.authenticateAsync({ promptMessage: prompt, cancelLabel, disableDeviceFallback: false });
    return r.success;
  } catch {
    return false;
  }
}
