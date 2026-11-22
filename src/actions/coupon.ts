"use server";

import { assertAdmin } from "@/lib/action-auth";
import { getClientIpOrNull } from "@/lib/client-ip";
import { revalidatePathAllLocales } from "@/lib/revalidate-locales";
import { adminCreateCoupon, adminSetCouponActive } from "@/services/CouponService";

/**
 * Kupon yönetimi — admin action'ları.
 *
 * Yazma işlemleri `CouponService` üzerinden gider: `Coupon` para yolundaki bir
 * model ve `service-layer-writes` mandalı bu tabloya servis dışından yazmayı
 * kesin olarak yasaklıyor.
 *
 * Her iki işlem de denetim kaydı bırakır. Kupon indirim demektir; "bu kuponu
 * kim açtı, ne zaman" sorusunun cevabı sonradan aranacak sorulardan biridir.
 */

export async function createCouponAction(data: unknown) {
  const actor = await assertAdmin();
  // Govde `adminCreateCoupon`da (sema, %100 siniri, denetim kaydi); mobil uc da onu cagirir.
  const result = await adminCreateCoupon(actor, data, { ip: await getClientIpOrNull() });
  if (!result.ok) return { success: false as const, error: result.reason };
  revalidatePathAllLocales("/admin/coupons");
  return { success: true as const };
}

export async function setCouponActiveAction(id: string, isActive: boolean) {
  const actor = await assertAdmin();
  const result = await adminSetCouponActive(actor, id, isActive, { ip: await getClientIpOrNull() });
  if (!result.ok) return { success: false as const, error: result.reason };
  revalidatePathAllLocales("/admin/coupons");
  return { success: true as const };
}
