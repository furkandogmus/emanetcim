import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import { getLocales } from "expo-localization";

import en from "@/locales/en.json";
import tr from "@/locales/tr.json";

const deviceLang = getLocales()[0]?.languageCode ?? "tr";

void i18n.use(initReactI18next).init({
  resources: { tr: { translation: tr }, en: { translation: en } },
  lng: deviceLang === "tr" ? "tr" : "en",
  fallbackLng: "tr",
  interpolation: { escapeValue: false },
  returnObjects: true,
});

export default i18n;
