import { Platform } from "react-native";
import Constants from "expo-constants";
import * as Notifications from "expo-notifications";
import { getLocales } from "expo-localization";
import { router } from "expo-router";

import { api, type DetachedSession } from "./api";
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
export async function unregisterPush(bearer?: string | DetachedSession): Promise<void> {
  if (!registeredToken) return;
  const token = registeredToken;
  registeredToken = null;
  await api("/push/register", { method: "DELETE", body: { token }, bearer }).catch(() => undefined);
}

/**
 * Bildirime dokununca ilgili rezervasyon acilir; role gore misafir ya da esnaf ekrani.
 * `bookingId` tasimayan bildirim (yonetici duyurusu) hicbir yere yonlendirmez: uygulama
 * oldugu yerde one gelir, soguk acilista capa rota (`index.tsx`) role gore ana sayfayi acar.
 */
export function openFromNotification(response: Notifications.NotificationResponse, role: Role | null) {
  const data = response.notification.request.content.data;
  if (role === "ADMIN") {
    const path = adminPathFromPush(data);
    if (path) router.push(path);
    return;
  }
  const bookingId = data?.bookingId;
  if (typeof bookingId !== "string" || !role) return;
  router.push(role === "PARTNER" ? `/partner/${bookingId}` : `/bookings/${bookingId}`);
}

/**
 * Yonetici bildirimi (`../src/lib/admin-push-copy.ts` `AdminPushData`) -> ekran. Sunucu serbest
 * yol gondermez; tanimadigimiz deger hicbir yere gitmez.
 */
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function adminPathFromPush(
  data: Record<string, unknown> | undefined,
): "/admin/disputes" | `/admin/dispute/${string}` | "/admin/applications" | "/admin/partner-leads" | "/admin/affiliates" | null {
  switch (data?.adminScreen) {
    case "dispute":
      // Yol parcasi push verisinden geliyor: yalnizca uuid kabul edilir (`Dispute.id`).
      return typeof data.disputeId === "string" && UUID.test(data.disputeId)
        ? `/admin/dispute/${data.disputeId}`
        : "/admin/disputes";
    case "applications":
      return "/admin/applications";
    case "partnerLeads":
      return "/admin/partner-leads";
    case "affiliates":
      return "/admin/affiliates";
    default:
      return null;
  }
}
