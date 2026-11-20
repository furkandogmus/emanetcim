import { Platform } from "react-native";
import * as SecureStore from "expo-secure-store";
import * as Updates from "expo-updates";
import Constants from "expo-constants";

import { api } from "./api";

const INSTALL_KEY = "bp.installId";
/** Son gonderilen "gun|kullanici"; ayni gun ayni kullaniciyla ikinci istek atilmaz. */
const LAST_KEY = "bp.lastPing";

let installId: string | null = null;
/** Acilista effect ile AppState ayni anda tetiklenebilir; ikinci cagri bekleyeni bulur ve cikar. */
let inflight: string | null = null;

/**
 * Kurulum kimligi: rastgele UUID v4, cihazda saklanir. Guvenlik anahtari degil,
 * yalnizca sayac; bu yuzden `Math.random` yeter ve yerel modul (OTA ile
 * gidemeyen) eklenmez.
 */
function uuid4() {
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    return (c === "x" ? r : (r & 0x3) | 0x8).toString(16);
  });
}

async function getInstallId() {
  if (installId) return installId;
  const stored = await SecureStore.getItemAsync(INSTALL_KEY).catch(() => null);
  installId = stored ?? uuid4();
  if (!stored) await SecureStore.setItemAsync(INSTALL_KEY, installId).catch(() => undefined);
  return installId;
}

/**
 * Uygulama acilisini sunucuya bildirir (tekil kullanici sayaci). Cihaz basina
 * gunde EN FAZLA bir istek; gun icinde yalnizca giris yapilinca (hesap cihaza
 * baglansin) bir kez daha. Ag yoksa ya da sunucu yanit vermezse sessizce
 * vazgecer: kuyruk yok, tekrar deneme yok, ekran beklemez.
 */
export async function pingAppOpen(userId: string | null) {
  const d = new Date();
  const key = `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}|${userId ?? ""}`;
  const last = await SecureStore.getItemAsync(LAST_KEY).catch(() => null);
  // Cikis yapinca bos kullaniciyla yeniden sayilmaz: ayni gun zaten sayildi.
  if (last === key || (!userId && last?.startsWith(key)) || inflight === key) return;
  inflight = key;
  try {
    // appVersion: runtimeVersion = yuklu ikilinin surumu; OTA sonrasi expoConfig yeni surumu gosterir.
    await api("/ping", {
      method: "POST",
      body: {
        installId: await getInstallId(),
        platform: Platform.OS === "ios" ? "ios" : "android",
        appVersion: Updates.runtimeVersion ?? Constants.expoConfig?.version,
      },
    });
    await SecureStore.setItemAsync(LAST_KEY, key).catch(() => undefined);
  } catch {
    // Sayac kaybi kabul edilebilir; kullaniciya yansimaz. Isaret yazilmaz, sonraki acilis dener.
  } finally {
    inflight = null;
  }
}
