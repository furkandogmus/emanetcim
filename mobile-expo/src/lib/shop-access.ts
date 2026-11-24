import type { MobileUser, PartnerDashboard, ShopAccess } from "./types";

/**
 * Dukkan personeli (2026-11-24): `PARTNER` rolu almaz, yetkisi sunucuda dukkan
 * uyeliginden gelir. Istemci yalniz ekranlari ayirir; asil kapi sunucuda.
 */

/** Secili dukkandaki yetki. Eski sunucu alani gondermez: sahip say (eski davranis). */
export function dashboardAccess(d: Pick<PartnerDashboard, "access"> | null | undefined): ShopAccess {
  return d?.access === "staff" ? "staff" : "owner";
}

/** Misafir rolundeki personel: esnaf paneline yol gosterilir. */
export function hasStaffPanel(user: Pick<MobileUser, "role" | "staffShopCount">): boolean {
  return user.role === "GUEST" && (user.staffShopCount ?? 0) > 0;
}

/** Acilis rotasi: rol, sonra personel uyeligi. */
export function landingRoute(user: Pick<MobileUser, "role" | "staffShopCount">): "/partner" | "/admin" | "/home" {
  if (user.role === "PARTNER") return "/partner";
  if (user.role === "ADMIN") return "/admin";
  return hasStaffPanel(user) ? "/partner" : "/home";
}

/** Rezervasyonun dukkanindaki yetki: detay ekrani secili dukkandan farkli olabilir. */
export function accessForShop(d: Pick<PartnerDashboard, "shops"> | null | undefined, shopId: string): ShopAccess {
  return d?.shops.find((s) => s.id === shopId)?.access === "staff" ? "staff" : "owner";
}
