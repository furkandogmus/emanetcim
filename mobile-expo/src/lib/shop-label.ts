import type { TFunction } from "i18next";

import { formatMoney } from "@/lib/format";
import type { NearbyShop } from "@/lib/types";

type PriceFields = Pick<NearbyShop, "isPrelaunch" | "priceRange" | "pricePerDay" | "stayQuote">;

/** Orta boy valizin gunlugu; eski sunucuda `priceRange` yoksa `pricePerDay`. */
export function mediumDaily(shop: PriceFields): number {
  return shop.priceRange?.medium ?? shop.pricePerDay;
}

/** "2 gun, 3 valiz": sunucunun saydigi gun ve adet. */
export function stayLabel(q: NonNullable<NearbyShop["stayQuote"]>, t: TFunction): string {
  return t("map.stayFor", {
    days: t("common.day", { count: q.days }),
    bags: t("common.bag", { count: q.bags }),
  });
}

/**
 * Ekran okuyucu icin fiyat/durum parcasi. Kart tek etiketle okundugundan kartta gorunen
 * fiyat ya da "Yakinda" rozeti etikete de girer; degerler sunucudan, istemcide hesap yok.
 */
export function shopPriceA11y(shop: PriceFields, t: TFunction): string {
  if (shop.isPrelaunch) return t("map.comingSoon");
  const daily = `${formatMoney(mediumDaily(shop))} ${t("map.perDayMedium")}`;
  if (!shop.stayQuote) return daily;
  return `${t("map.stayTotalA11y", { price: formatMoney(shop.stayQuote.total), stay: stayLabel(shop.stayQuote, t) })}, ${daily}`;
}
