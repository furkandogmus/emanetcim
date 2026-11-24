import { Linking } from "react-native";
import { SITE_ORIGIN } from "./images";
import { languageInfo } from "./languages";

/** Site sayfasi kullanicinin dilinde (`ru` gibi sitede olmayan dil `languageInfo` eslemesiyle). */
export function sitePage(path: string, lang: string) {
  return `${SITE_ORIGIN}/${languageInfo(lang).site}/${path}`;
}

/** Tarayicida acar; acilamazsa sessiz gecer. */
export function openSitePage(path: string, lang: string) {
  void Linking.openURL(sitePage(path, lang)).catch(() => undefined);
}
