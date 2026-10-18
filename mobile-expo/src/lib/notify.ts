import { Alert } from "react-native";

import i18n from "./i18n";

/**
 * Tek dugmeli bilgi penceresi. `Alert.alert(baslik, govde)` dugme verilmezse
 * Android'de cihaz dilinden bagimsiz "OK" basar; Turkce arayuzde Ingilizce
 * dugme kaliyordu (2026-10-18, esnaf teslim al/et). Dugme metni uygulama
 * dilinden gelir.
 */
export function notify(title: string, body?: string) {
  Alert.alert(title, body, [{ text: i18n.t("common.ok") }]);
}
