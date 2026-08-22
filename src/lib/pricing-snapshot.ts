import type { Prisma } from "@prisma/client";
import type { PricingRules } from "@/lib/pricing-rules";

/**
 * Rezervasyonun fiyatını üreten kuralların anlık kopyası.
 *
 * NEDEN: `PlatformSettings` tek satırlık ve sürümsüz. Admin bir çarpanı
 * değiştirdiği anda GEÇMİŞ tahsilatlar yeniden üretilemez hale geliyordu.
 * 2026-08-22'de ölçüldü: 19 rezervasyonun tamamı `insuranceFee = 150.00` taşıyor,
 * canlı ayar `0.00`; kayıtlı 440.00'lık bir toplam bugünkü kurallarla 150.00
 * çıkıyor (P0-4). Anlaşmazlıkta, faturada ve iadede "o gün hangi kural
 * geçerliydi" sorusunun tek cevabı bu kopyadır.
 *
 * `SNAPSHOT_VERSION` alan kümesi değiştiğinde artar; eski kayıtlar okunurken
 * hangi şemayla yazıldıkları buradan bilinir.
 */
export const SNAPSHOT_VERSION = 1;

export type PricingSnapshot = PricingRules & {
  v: number;
  /** ISO 8601 — kopyanın alındığı an. */
  at: string;
};

/** Rezervasyon yaratılırken çağrılır. Sonradan ASLA güncellenmez. */
export function toPricingSnapshot(
  rules: PricingRules,
  at: Date = new Date(),
): Prisma.InputJsonValue {
  const snapshot: PricingSnapshot = {
    ...rules,
    v: SNAPSHOT_VERSION,
    at: at.toISOString(),
  };
  return snapshot as unknown as Prisma.InputJsonValue;
}

/**
 * Kayıtlı kopyayı geri okur. Kopya yoksa `null` döner — UYDURMAZ.
 *
 * Bu migrasyondan önceki rezervasyonlarda kopya gerçekten yok ve o kayıtlar için
 * hangi kuralın geçerli olduğu bilinmiyor. Bugünkü kuralları varsaymak, tam da
 * P0-4'ün yarattığı yanlış güveni tekrar üretmek olurdu.
 */
export function readPricingSnapshot(value: unknown): PricingSnapshot | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const o = value as Record<string, unknown>;
  if (typeof o.v !== "number" || typeof o.at !== "string") return null;
  if (typeof o.insuranceFeeTry !== "number") return null;
  return o as unknown as PricingSnapshot;
}
