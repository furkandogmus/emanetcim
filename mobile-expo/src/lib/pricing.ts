import type { ShopDetail } from "./types";

/**
 * Tahmini tutar -- sunucudaki `computeAuthoritativeCheckoutTotals` ile ayni
 * formul (ara yuvarlama yok, sonda 2 hane). Kesin tutar sunucunun; burasi
 * yalnizca onaydan once gostermek icin. Carpanlar ve sigorta sunucudan gelir,
 * istemcide SABIT YAZILMAZ (2026-09-23 hatasi: mobil farkli tutar gosteriyordu).
 */
export function estimate(shop: ShopDetail, bags: { s: number; m: number; xl: number }, days: number) {
  const p = shop.pricing;
  const lines = [
    { size: "s" as const, count: bags.s, unit: shop.pricePerDay * p.bagMultiplierS },
    { size: "m" as const, count: bags.m, unit: shop.pricePerDay * p.bagMultiplierM },
    { size: "xl" as const, count: bags.xl, unit: shop.pricePerDay * p.bagMultiplierXl },
  ].filter((l) => l.count > 0);
  const service = lines.reduce((sum, l) => sum + l.count * l.unit * days, 0);
  const insurance = service > 0 ? p.insuranceFeeTry : 0;
  return { lines, insurance, total: Math.round((service + insurance) * 100) / 100 };
}
