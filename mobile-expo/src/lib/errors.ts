import i18n from "./i18n";
import { ApiError } from "./api";

/**
 * Sunucu hata kodunu kullaniciya gosterilecek metne cevirir. Ham `error`
 * metni ASLA ekrana basilmaz; bilinmeyen kod genel mesaja duser.
 */
export function errorMessage(err: unknown, namespace?: string): string {
  if (err instanceof ApiError) {
    if (err.code === "network") return i18n.t("common.networkError");
    if (namespace) {
      const key = `${namespace}.errors.${err.code}`;
      if (i18n.exists(key)) return i18n.t(key);
    }
  }
  return i18n.t("common.genericError");
}
