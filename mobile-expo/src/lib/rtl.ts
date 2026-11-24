import { DevSettings, I18nManager, Platform } from "react-native";
import * as SecureStore from "expo-secure-store";
import * as Updates from "expo-updates";

/**
 * Yerlesim yonu uygulama dilinden gelir, cihazdan degil. expo-localization'in `supportsRTL`
 * ayari bilerek KAPALI: iOS'ta her acilista `forceRTL`'i cihaz diline geri yaziyor; bu hem
 * uygulama icinden secilen Farsca'yi sonraki acilista soldan saga ceviriyor hem de Arapca /
 * Ibranice telefonlu (dili Ingilizceye dusen) turistte ekrani aynaliyordu. Android'de
 * `allowRTL` varsayilan acik oldugu icin ayni ayna sorunu zaten vardi.
 *
 * Yon degisikligi yalniz yeniden yuklemeyle gecerli olur (RN `isRTL`i acilista okur).
 */
const RTL_LANGUAGES: ReadonlySet<string> = new Set(["fa"]);
// Yeniden yukleme denendi ama yon degismediyse (platform yok sayarsa) dongu olmasin.
const ATTEMPT_KEY = "rtl_reload_attempt";

export function isRtlLanguage(lang: string): boolean {
  return RTL_LANGUAGES.has(lang);
}

async function reload() {
  try {
    await Updates.reloadAsync();
  } catch {
    // Gelistirme derlemesinde expo-updates kapali; Metro yeniden yuklemesi ayni isi gorur.
    DevSettings.reload();
  }
}

/**
 * Dilin yonu su anki yerlesimle uyusmuyorsa RN bayraklarini ayarlar ve uygulamayi yeniden
 * yukler. `userAction` dil seciminden gelir: her zaman dener. Acilistaki kontrol ayni yon
 * icin yalnizca bir kez dener.
 */
export async function syncLayoutDirection(lang: string, userAction = false): Promise<boolean> {
  if (Platform.OS === "web") return false;
  const rtl = isRtlLanguage(lang);
  const want = rtl ? "rtl" : "ltr";
  if (rtl === I18nManager.isRTL) {
    await SecureStore.deleteItemAsync(ATTEMPT_KEY).catch(() => undefined);
    return false;
  }
  if (!userAction) {
    const tried = await SecureStore.getItemAsync(ATTEMPT_KEY).catch(() => null);
    if (tried === want) return false;
  }
  I18nManager.allowRTL(rtl);
  I18nManager.forceRTL(rtl);
  await SecureStore.setItemAsync(ATTEMPT_KEY, want).catch(() => undefined);
  await reload();
  return true;
}

/** Yone bagli ikonlar (geri oku, ileri chevron) sag-sol yerlesimde aynalanir. */
export const flipInRtl = I18nManager.isRTL ? { transform: [{ scaleX: -1 }] } : undefined;
