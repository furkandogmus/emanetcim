import { Platform } from "react-native";
import Constants from "expo-constants";
import * as Notifications from "expo-notifications";
import { getLocales } from "expo-localization";
import { router } from "expo-router";

import { api } from "./api";
import type { Role } from "./types";

/*
  Sunucu mobil bildirimi dogrudan FCM'e gonderir (`NotificationService.sendMobilePush`,
  firebase-admin). Bu yuzden Expo push token'i DEGIL, cihazin yerel token'i
  (`getDevicePushTokenAsync`: Android'de FCM) kaydedilir. iOS'ta yerel token APNs'indir
  ve FCM onu almaz: orada Expo push token'i kaydedilir, sunucu onu Expo servisine
  gonderir (`src/lib/expo-push.ts`), Expo da EAS'taki APNs anahtariyla iletir. Esnafa yeni rezervasyon,
  misafire onay/check-in/hatirlatma/valiz duzeltmesi gider; veride `bookingId` gelir.
*/

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

let registeredToken: string | null = null;

/**
 * `prompt: false`: izin yoksa SORMAZ, yalnizca zaten verilmisse token'i kaydeder.
 * Misafire izin penceresi girişte degil, ilk rezervasyondan sonra cikar; o anda
 * "neden bildirim" sorusunun cevabi belli.
 */
export async function registerForPush({ prompt = true }: { prompt?: boolean } = {}): Promise<void> {
  if (Platform.OS === "android") {
    await Notifications.setNotificationChannelAsync("default", {
      name: "BagajPark",
      importance: Notifications.AndroidImportance.HIGH,
    });
  }
  const current = await Notifications.getPermissionsAsync();
  if (!current.granted && (!prompt || !current.canAskAgain)) return;
  const status = current.granted ? current : await Notifications.requestPermissionsAsync();
  if (!status.granted) return;

  const token =
    Platform.OS === "ios"
      ? (await Notifications.getExpoPushTokenAsync({ projectId: Constants.expoConfig?.extra?.eas?.projectId })).data
      : (await Notifications.getDevicePushTokenAsync()).data;
  if (typeof token !== "string" || token === registeredToken) return;
  await api("/push/register", {
    method: "POST",
    body: {
      token,
      platform: Platform.OS === "ios" ? "ios" : "android",
      appVersion: Constants.expoConfig?.version,
      locale: getLocales()[0]?.languageCode ?? "tr",
    },
  });
  registeredToken = token;
}

/**
 * Oturum suresi dolunca: token sunucuda silinemez (oturum yok) ama bir sonraki giriste
 * yeniden kaydedilmeli. Yoksa "ayni token" erken donusu kaydi atlar, sunucu satiri
 * eski kullaniciya bagli kalir ve yeni kullanici oncekinin bildirimlerini alir.
 */
export function forgetPushRegistration() {
  registeredToken = null;
}

/**
 * Cikista: token silinmezse cikis yapmis esnafin telefonuna bildirim gitmeye devam eder.
 * `bearer`: yerel oturum silindikten sonra arka planda gonderilir (auth.tsx signOut).
 */
export async function unregisterPush(bearer?: string): Promise<void> {
  if (!registeredToken) return;
  const token = registeredToken;
  registeredToken = null;
  await api("/push/register", { method: "DELETE", body: { token }, bearer }).catch(() => undefined);
}

/** Bildirime dokununca ilgili rezervasyon acilir; role gore misafir ya da esnaf ekrani. */
export function openFromNotification(response: Notifications.NotificationResponse, role: Role | null) {
  const bookingId = response.notification.request.content.data?.bookingId;
  if (typeof bookingId !== "string" || !role) return;
  router.push(role === "PARTNER" ? `/partner/${bookingId}` : `/bookings/${bookingId}`);
}
