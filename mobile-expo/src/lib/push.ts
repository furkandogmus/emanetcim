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
  (`getDevicePushTokenAsync`: Android'de FCM) kaydedilir. Bugun tek gonderim:
  esnafa yeni rezervasyon; veride `bookingId` gelir.
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

export async function registerForPush(): Promise<void> {
  if (Platform.OS === "android") {
    await Notifications.setNotificationChannelAsync("default", {
      name: "BagajPark",
      importance: Notifications.AndroidImportance.HIGH,
    });
  }
  const current = await Notifications.getPermissionsAsync();
  const status = current.granted ? current : await Notifications.requestPermissionsAsync();
  if (!status.granted) return;

  const { data: token } = await Notifications.getDevicePushTokenAsync();
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

/** Cikista: token silinmezse cikis yapmis esnafin telefonuna bildirim gitmeye devam eder. */
export async function unregisterPush(): Promise<void> {
  if (!registeredToken) return;
  const token = registeredToken;
  registeredToken = null;
  await api("/push/register", { method: "DELETE", body: { token } }).catch(() => undefined);
}

/** Bildirime dokununca ilgili rezervasyon acilir; role gore misafir ya da esnaf ekrani. */
export function openFromNotification(response: Notifications.NotificationResponse, role: Role | null) {
  const bookingId = response.notification.request.content.data?.bookingId;
  if (typeof bookingId !== "string" || !role) return;
  router.push(role === "PARTNER" ? `/partner/${bookingId}` : `/bookings/${bookingId}`);
}
