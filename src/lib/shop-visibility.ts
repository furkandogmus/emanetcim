/**
 * Gercek bir dukkani misafirden saklayan ya da zayiflatan durumlar; web ve mobil
 * admin ayni listeyi gosterir. Sira onem sirasi: pasif dukkan hicbir yerde yok,
 * konumsuz dukkan arama ve haritada yok, sehir sayfasi olmayan yalnizca konumla bulunur.
 */
export type ShopVisibilityIssue = "inactive" | "noLocation" | "noCityPage" | "noPhoto";

export function shopVisibilityIssues(shop: {
  isActive: boolean;
  latitude: number | null;
  longitude: number | null;
  image: string | null;
  cityPages: readonly string[];
}): ShopVisibilityIssue[] {
  const issues: ShopVisibilityIssue[] = [];
  if (!shop.isActive) issues.push("inactive");
  if (shop.latitude == null || shop.longitude == null) issues.push("noLocation");
  else if (shop.cityPages.length === 0) issues.push("noCityPage");
  if (!shop.image) issues.push("noPhoto");
  return issues;
}
