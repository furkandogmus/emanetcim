import { Role } from "@prisma/client";
import { writeAuditLog } from "@/lib/audit-log";
import type { Prisma } from "@prisma/client";

/** Dukkan icerigini degistiren kisi; `ip` yalnizca denetim kaydi icin. */
export type ShopEditActor = { id: string; role: Role | string; ip?: string | null };

/**
 * Yonetici, esnaf adina dukkan icerigini (fotograf, saat, izin) degistirdiginde
 * denetim kaydi. Esnafin kendi duzenlemesi kayda girmez: o zaten dukkanin
 * sahibi, kayit "kim baskasinin dukkanina dokundu" sorusunun cevabi.
 *
 * Yazma servislerde (`ShopScheduleService`, `ShopGalleryService`,
 * `ShopService.setShopImage`) cagrilir; web action'i ve mobil admin ucu
 * ayni govdeden gectigi icin iki tasiyici da ayni kaydi birakir.
 */
export function auditAdminShopEdit(
  actor: ShopEditActor | undefined,
  shopId: string,
  action: string,
  metadata?: Prisma.InputJsonObject,
): void {
  if (!actor || actor.role !== Role.ADMIN) return;
  writeAuditLog({
    actorUserId: actor.id,
    actorRole: "ADMIN",
    action: `admin.shop.${action}`,
    entityType: "Shop",
    entityId: shopId,
    metadata,
    ip: actor.ip ?? null,
  });
}
