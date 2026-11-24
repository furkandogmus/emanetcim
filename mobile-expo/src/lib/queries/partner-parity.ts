import { api } from "../api";
import { withShop } from "../partner-shop";
import type { PartnerPhoneResult, PartnerPosterLink } from "../types";

/** Afis bagi her dokunusta yeniden imzalanir (15 dk omurlu); onbellege alinmaz. */
export function fetchPartnerPosterLink(shopId: string | null, locale: string) {
  const lang = locale.split("-")[0] || "tr";
  return api<PartnerPosterLink>(withShop(`/partner/poster?locale=${encodeURIComponent(lang)}`, shopId));
}

/** Yeni rezervasyon SMS'inin gittigi numara (sahibin `User.phone`). `null` siler. */
export function savePartnerPhone(phone: string | null) {
  return api<PartnerPhoneResult>("/partner/phone", { method: "PUT", body: { phone } });
}

/** Konum pini: `partner/shop` PUT'unun yalniz koordinat alanlari. */
export function savePartnerShopLocation(shopId: string | null, coords: { latitude: number; longitude: number }) {
  return api<unknown>(withShop("/partner/shop", shopId), { method: "PUT", body: coords });
}
