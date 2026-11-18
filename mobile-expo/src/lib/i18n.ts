import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import { getLocales } from "expo-localization";
import * as SecureStore from "expo-secure-store";

import de from "@/locales/de.json";
import en from "@/locales/en.json";
import ru from "@/locales/ru.json";
import tr from "@/locales/tr.json";

import { isAppLanguage, type AppLanguage } from "./languages";

const deviceLang = getLocales()[0]?.languageCode ?? "tr";

// Adlandirilmis `use` export'u this'siz; ornek uzerinden cagrilmali.
// eslint-disable-next-line import/no-named-as-default-member
void i18n.use(initReactI18next).init({
  resources: { tr: { translation: tr }, en: { translation: en }, de: { translation: de }, ru: { translation: ru } },
  lng: isAppLanguage(deviceLang) ? deviceLang : "en",
  // Eksik ceviri once Ingilizceye duser: yabanci kullaniciya Turkce metin gostermez.
  fallbackLng: ["en", "tr"],
  interpolation: { escapeValue: false },
  returnObjects: true,
});

/** Kullanicinin profilden sectigi dil cihaz dilini ezer; turistin telefonu Turkce olmayabilir. */
const LANG_KEY = "app_language";

// Promise icinde: modul yuklenirken SecureStore yoksa (test, eski build) hata yutulur.
void Promise.resolve()
  .then(() => SecureStore.getItemAsync(LANG_KEY))
  .then((lang) => {
    // eslint-disable-next-line import/no-named-as-default-member
    if (isAppLanguage(lang) && i18n.language !== lang) void i18n.changeLanguage(lang);
  })
  .catch(() => undefined);

export async function setAppLanguage(lang: AppLanguage) {
  // eslint-disable-next-line import/no-named-as-default-member
  await i18n.changeLanguage(lang);
  await SecureStore.setItemAsync(LANG_KEY, lang).catch(() => undefined);
}

export default i18n;
