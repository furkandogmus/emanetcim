import i18n from "./i18n";
import { ApiError } from "./api";

/**
 * Sunucu hata kodunu kullaniciya gosterilecek metne cevirir. Ham `error`
 * metni ASLA ekrana basilmaz; bilinmeyen kod genel mesaja duser.
 */
export function errorMessage(err: unknown, namespace?: string): string {
  if (err instanceof ApiError) {
    // 503: sunucu gecici olarak veritabanina/Redis'e ulasamadi; kullanici icin ag hatasiyla ayni.
    if (err.code === "network" || err.code === "service_unavailable") return i18n.t("common.networkError");
    // Hangi ekranda olursa olsun ayni aciklama: "bir seyler ters gitti" islemin bozuldugunu sandiriyordu.
    if (err.code === "session_expired") return i18n.t("auth.sessionExpiredTitle");
    if (namespace) {
      const key = `${namespace}.errors.${err.code}`;
      if (i18n.exists(key)) return i18n.t(key);
    }
  }
  return i18n.t("common.genericError");
}
