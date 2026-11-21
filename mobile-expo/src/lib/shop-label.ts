import type { TFunction } from "i18next";

import { formatMoney } from "@/lib/format";
import type { NearbyShop } from "@/lib/types";

/**
 * Ekran okuyucu icin fiyat/durum parcasi. Kart tek etiketle okundugundan (cocuklar
 * okunmaz) kartta gorunen fiyat ya da "Yakinda" rozeti etikete de girer; deger
 * sunucudan gelen ayni alan, istemcide hesap yok.
 */
export function shopPriceA11y(
  shop: Pick<NearbyShop, "isPrelaunch" | "priceRange" | "pricePerDay">,
  t: TFunction,
): string {
  if (shop.isPrelaunch) return t("map.comingSoon");
  return `${formatMoney(shop.priceRange?.medium ?? shop.pricePerDay)} ${t("map.perDayMedium")}`;
}
