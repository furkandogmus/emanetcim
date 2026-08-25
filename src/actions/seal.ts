"use server";

import prisma from "@/lib/db";
import logger from "@/lib/logger";
import { sealService } from "@/services/SealService";
import { revalidatePathAllLocales } from "@/lib/revalidate-locales";
import { requireAdmin, requirePartner } from "@/lib/action-auth";

/*
  Yakalanan hatanın metni DÖNMEZ (2026-08-25). Eskiden `e.message` dönüyordu ve
  `PartnerSealsClient` / `AdminSealInventoryClient` gelen değeri ekrana aynen
  basıyordu — esnaf ekranında Prisma hata metni görünebiliyordu. Kod `"unknown"`
  olarak sabit; gösterim tarafı bunu `Errors.generic`e eşliyor
  (`src/lib/action-error.ts`). Gerçek sebep loglarda.
*/


/**
 * Servis sonuc KODU -> bu dosyanin snake_case dis sozlesmesi.
 * Kodlar DEGISMEDI: `PartnerSealsClient` / `AdminSealInventoryClient` bunlari
 * `Errors.*` anahtarina `src/lib/action-error.ts` uzerinden esliyor.
 */
const SEAL_CODE_TO_ERROR: Record<string, string> = {
  FORBIDDEN: "unauthorized",
  INVALID_QUANTITY: "invalid_quantity",
  SHOP_NOT_FOUND: "shop_not_found",
  REQUEST_NOT_FOUND: "request_not_found",
  REQUEST_NOT_SHIPPED: "request_not_shipped",
  REQUEST_NOT_PENDING: "request_not_pending",
  TRACKING_REQUIRED: "tracking_number_required",
  INVALID_SERIAL_RANGE: "invalid_serial_range",
  UNKNOWN: "unknown",
};

function revalidateSealPaths() {
  revalidatePathAllLocales("/admin/seals");
  revalidatePathAllLocales("/partner/seals");
}

// ─── Admin: kargo bilgisiyle talebi SHIPPED yap ──────────────────────────────

/**
 * Admin: talebi kargoya verir. Govde `SealService.shipRequest`'te.
 * Burada kalan tek is ADMIN yetkisi ve `revalidate`.
 */
export async function shipSealRequestAction(params: {
  requestId: string;
  trackingNumber: string;
  quantity?: number;
  serialFrom?: number;
  serialTo?: number;
  adminNote?: string;
}): Promise<{ success: boolean; error?: string }> {
  const auth = await requireAdmin();
  if (!auth.ok) return { success: false, error: SEAL_CODE_TO_ERROR.FORBIDDEN };

  const result = await sealService.shipRequest(params);
  if (!result.ok) {
    return { success: false, error: SEAL_CODE_TO_ERROR[result.code] ?? "unknown" };
  }

  revalidateSealPaths();
  return { success: true };
}

// ─── Partner: talebi DELIVERED yap + mühürleri ASSIGNED'a geçir ──────────────

/**
 * Esnaf: kargoyu teslim aldigini bildirir.
 *
 * Govde `SealService.confirmDelivery`'de — muhurlerin dukkana ATANMASI da orada,
 * ayni transaction icinde. Mobil uc de ayni cagriyi yapar.
 */
export async function confirmSealDeliveryAction(
  requestId: string
): Promise<{ success: boolean; error?: string }> {
  const auth = await requirePartner();
  if (!auth.ok) return { success: false, error: SEAL_CODE_TO_ERROR.FORBIDDEN };

  const result = await sealService.confirmDelivery(requestId, auth.actor);

  if (!result.ok) {
    return { success: false, error: SEAL_CODE_TO_ERROR[result.code] ?? "unknown" };
  }

  revalidateSealPaths();
  return { success: true };
}

// ─── Partner: mühür talebi aç ────────────────────────────────────────────────

export async function requestSealsAction(
  shopId: string,
  quantity: number
): Promise<{ success: boolean; requestId?: string; error?: string }> {
  const auth = await requirePartner();
  if (!auth.ok) return { success: false, error: SEAL_CODE_TO_ERROR.FORBIDDEN };

  const result = await sealService.createRequest(shopId, quantity, auth.actor);

  if (!result.ok) {
    return { success: false, error: SEAL_CODE_TO_ERROR[result.code] ?? "unknown" };
  }

  revalidateSealPaths();
  return { success: true, requestId: result.requestId };
}

// ─── Admin: RETURNED mühürleri geri dönüştür ─────────────────────────────────

export async function recycleReturnedSealsAction(
  shopId: string
): Promise<{ success: boolean; recycled: number; error?: string }> {
  const auth = await requirePartner();
  if (!auth.ok) {
    return { success: false, recycled: 0, error: SEAL_CODE_TO_ERROR.FORBIDDEN };
  }

  /*
    ROL kapisi yukarida; burada kalan SAHIPLIK kuralidir: admin her dükkanı,
    esnaf yalnızca kendi dükkanını geri dönüştürebilir.
  */
  if (auth.actor.role !== "ADMIN") {
    const shop = await prisma.shop.findFirst({
      where: { id: shopId, ownerId: auth.actor.id },
      select: { id: true },
    });
    if (!shop) {
      return { success: false, recycled: 0, error: SEAL_CODE_TO_ERROR.SHOP_NOT_FOUND };
    }
  }

  try {
    const recycled = await sealService.recycleReturnedSeals(shopId);
    revalidatePathAllLocales("/admin/seals");
    revalidatePathAllLocales("/partner/seals");
    return { success: true, recycled };
  } catch (e) {
    logger.error({ err: e }, "recycleReturnedSealsAction");
    return {
      success: false,
      recycled: 0,
      error: "unknown",
    };
  }
}
