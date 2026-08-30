"use server";

import { z } from "zod";
import { assertAdmin } from "@/lib/action-auth";
import { writeAuditLog } from "@/lib/audit-log";
import { revalidatePathAllLocales } from "@/lib/revalidate-locales";
import { couponService } from "@/services/CouponService";

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

const createCouponSchema = z.object({
  code: z
    .string()
    .trim()
    .min(3)
    .max(32)
    // Bosluk ve noktalama, kuponun elle yazilmasini zorlastirir; misafir kodu
    // yanlis yazarsa indirim "calismiyor" diye geri doner.
    .regex(/^[A-Za-z0-9_-]+$/),
  discount: z.number().positive().max(100_000),
  isPercent: z.boolean(),
  minPrice: z.number().min(0).max(1_000_000).nullable(),
  maxUses: z.number().int().min(1).max(1_000_000).nullable(),
  expiresAt: z.string().datetime().nullable(),
});

export async function createCouponAction(data: unknown) {
  const actor = await assertAdmin();

  const parsed = createCouponSchema.safeParse(data);
  if (!parsed.success) {
    return { success: false as const, error: "invalid_data" as const };
  }
  const d = parsed.data;

  // Yuzde indirim 100'u asamaz: asarsa `applyDiscount` negatifi 0'a kirpar ve
  // kupon sessizce "her seyi bedava yap" haline gelir.
  if (d.isPercent && d.discount > 100) {
    return { success: false as const, error: "invalid_data" as const };
  }

  const result = await couponService.create({
    code: d.code,
    discount: d.discount,
    isPercent: d.isPercent,
    minPrice: d.minPrice,
    maxUses: d.maxUses,
    expiresAt: d.expiresAt ? new Date(d.expiresAt) : null,
  });

  if (!result.ok) {
    return { success: false as const, error: "duplicate_code" as const };
  }

  writeAuditLog({
    actorUserId: actor.id,
    actorRole: actor.role,
    action: "coupon.create",
    entityType: "Coupon",
    entityId: result.id,
    metadata: {
      code: result.code,
      discount: d.discount,
      isPercent: d.isPercent,
      maxUses: d.maxUses,
    },
  });

  revalidatePathAllLocales("/admin/coupons");
  return { success: true as const };
}

export async function setCouponActiveAction(id: string, isActive: boolean) {
  const actor = await assertAdmin();

  await couponService.setActive(id, isActive);

  writeAuditLog({
    actorUserId: actor.id,
    actorRole: actor.role,
    action: isActive ? "coupon.activate" : "coupon.deactivate",
    entityType: "Coupon",
    entityId: id,
  });

  revalidatePathAllLocales("/admin/coupons");
  return { success: true as const };
}
