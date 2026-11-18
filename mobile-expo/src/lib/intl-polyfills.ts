/*
  Hermes Android'de `Intl.PluralRules` yok: i18next cogul bicimini tahmin ediyor,
  Rusca "27 дня" yaziyordu (dogrusu "27 дней"). Yalnizca eksikse uygulanir.
  Kok `_layout`un ILK importu: i18next ilk cogul cevirisinden once kuralin hazir
  olmasi gerekir. Testler bunu yuklemez (Node'da PluralRules var).
*/
import "@formatjs/intl-pluralrules/polyfill.js";
import "@formatjs/intl-pluralrules/locale-data/de.js";
import "@formatjs/intl-pluralrules/locale-data/en.js";
import "@formatjs/intl-pluralrules/locale-data/ru.js";
import "@formatjs/intl-pluralrules/locale-data/tr.js";
