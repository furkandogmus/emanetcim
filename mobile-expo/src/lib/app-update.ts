import { Linking, Platform } from "react-native";
import * as Updates from "expo-updates";
import Constants from "expo-constants";

import { api } from "./api";
import type { AppConfig } from "./types";

/** Play Store sayfasi; `market://` Play yoksa (emulator, Huawei) https'e duser. */
const PLAY_URL = "https://play.google.com/store/apps/details?id=com.bagajpark";
const PLAY_MARKET_URL = "market://details?id=com.bagajpark";
/** App Store sayfasi (App Store Connect uygulama kimligi); `itms-apps://` acilamazsa https. */
const APP_STORE_ID = "6838203193";
const APP_STORE_URL = `https://apps.apple.com/app/id${APP_STORE_ID}`;
const APP_STORE_NATIVE_URL = `itms-apps://apps.apple.com/app/id${APP_STORE_ID}`;

/** Zorunlu guncellemede acilacak magaza adresleri: once uygulama semasi, sonra https. */
export function storeUrls(os: string): [native: string, web: string] {
  return os === "ios" ? [APP_STORE_NATIVE_URL, APP_STORE_URL] : [PLAY_MARKET_URL, PLAY_URL];
}


/** "0.3.3" -> [0,3,3]; ayristirilamazsa null (kapi acik kalir, kullaniciyi kilitlemeyiz). */
export function parseVersion(v: string | null | undefined): number[] | null {
  if (!v) return null;
  const m = /^\s*v?(\d+)(?:\.(\d+))?(?:\.(\d+))?/.exec(v);
  if (!m) return null;
  return [Number(m[1]), Number(m[2] ?? 0), Number(m[3] ?? 0)];
}

/** `current` `min`den KUCUKSE true. Bilinmeyen/bozuk surum kapiyi kapatmaz. */
export function isBelowMinVersion(current: string | null | undefined, min: string | null | undefined): boolean {
  const c = parseVersion(current);
  const m = parseVersion(min);
  if (!c || !m) return false;
  for (let i = 0; i < 3; i++) {
    if (c[i] !== m[i]) return c[i] < m[i];
  }
  return false;
}

/**
 * Yuklu ikilinin surumu. OTA sonrasi `expoConfig.version` yeni JS'in surumunu gosterir;
 * `runtimeVersion` (appVersion politikasi) ikilinin surumudur ve zorunlu guncelleme
 * ikili icin sorulur (app-ping.ts ile ayni kaynak).
 */
export function installedBinaryVersion(): string | null {
  return Updates.runtimeVersion ?? Constants.expoConfig?.version ?? null;
}

/**
 * Giris ONCESI zorunlu guncelleme kapisi. Ag yoksa ya da sunucu yanit vermezse
 * `false`: kapi hata durumunda acik kalir, cevrimdisi kullanici kilitlenmez.
 */
export async function isUpdateRequired(): Promise<boolean> {
  try {
    const cfg = await api<AppConfig>("/config", { auth: false });
    return isBelowMinVersion(installedBinaryVersion(), cfg.minAppVersion);
  } catch {
    return false;
  }
}

/** Cihazin kendi magazasini acar: iOS'ta App Store, digerlerinde Google Play. */
export async function openAppStore(os: string = Platform.OS): Promise<void> {
  const [native, web] = storeUrls(os);
  try {
    await Linking.openURL(native);
  } catch {
    await Linking.openURL(web).catch(() => undefined);
  }
}

/**
 * "Yeni surum hazir" seridi odeme ve QR okutma ekraninda gosterilmez: alttaki
 * ana dugmeyi kapatir, tek cikisi da uygulamayi yeniden baslatip ekrani yitirmek olurdu.
 */
export function isOtaBannerBlocked(pathname: string): boolean {
  return /(^|\/)(checkout|scan)(\/|$)/.test(pathname);
}
