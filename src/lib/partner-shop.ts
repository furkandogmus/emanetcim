import prisma from "@/lib/db";

/**
 * Esnaf panelinde AKTİF DÜKKANI seçen tek yer.
 *
 * NEDEN VAR (2026-08-31'de ölçüldü): çok dükkanlı esnaf için panel ile alt
 * sayfalar FARKLI dükkanı gösteriyordu.
 *
 *   - `partner/page.tsx`      → `?shop=` ile seçim yapıyor, sahiplik listesinden doğruluyor
 *   - `partner/earnings`      → `findFirst({ ownerId })` — `?shop=`'u hiç okumuyor
 *   - `partner/seals`         → `findFirst({ ownerId })` — aynı şekilde
 *
 * `findFirst` sıralamasız çalışır, yani hangi dükkanın geleceği veritabanının
 * plan seçimine kalmıştır. Esnaf panelde Sultanahmet'i seçip "Kazançlar"a
 * bastığında Galata'nın rakamlarını görüyordu — ve iki ekran arasında hangisinin
 * doğru olduğunu anlamasının bir yolu yoktu. Mühür sayfasında sonuç daha ağır:
 * yanlış dükkanın mühür stoğuna bakıp doğru dükkan için sipariş vermiyordu.
 *
 * Seçim ARTIK HER YERDE AYNI: `?shop=` sahiplik listesinde varsa o, yoksa
 * deterministik olarak en yeni dükkan.
 */

export type PartnerShopRef = { id: string; name: string };

/** Sıralama SABİT: `findFirst`in plan-bağımlı davranışının yerine geçer. */
const SHOP_ORDER = { createdAt: "desc" } as const;

/**
 * Esnafın dükkanlarını ve aktif olanı çözer.
 *
 * `requestedShopId` sahiplik listesinde YOKSA sessizce ilkine düşer — hata
 * göstermek yerine: kimliği elle değiştiren biri başkasının dükkanını göremez
 * (asıl koruma bu), yalnız dükkanını silmiş/devretmiş esnaf da eski bağlantıyla
 * kilitlenmez.
 */
export async function resolvePartnerShops(
  ownerId: string,
  requestedShopId?: string | null,
): Promise<{ shops: PartnerShopRef[]; activeShop: PartnerShopRef | null }> {
  const shops = await prisma.shop.findMany({
    where: { ownerId },
    orderBy: SHOP_ORDER,
    select: { id: true, name: true },
  });

  const requested = requestedShopId?.trim();
  const activeShop =
    (requested ? shops.find((s) => s.id === requested) : undefined) ?? shops[0] ?? null;

  return { shops, activeShop };
}
