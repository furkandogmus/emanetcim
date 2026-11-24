import { listAccessibleShops, type ShopAccessLevel } from "@/lib/shop-access";

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

/** `isActive`: onay bekleyen basvuru ayirt edilsin (dukkan seciminde "Onay bekliyor"). */
export type PartnerShopRef = { id: string; name: string; isActive: boolean; relation: "owner" | "staff" };

/**
 * Esnafin (ya da personelin) dukkanlarini ve aktif olani cozer.
 *
 * `level`: `manage` yalniz sahip olunanlari, `operate` personel olunanlari da listeler
 * (`src/lib/shop-access.ts`). Varsayilan `manage`: eski cagiranlar personeli gormez.
 *
 * `requestedShopId` listede YOKSA sessizce ilkine duser: kimligi elle degistiren biri
 * baskasinin dukkanini goremez (asil koruma bu), yalniz dukkanini devretmis esnaf da
 * eski baglantiyla kilitlenmez.
 */
export async function resolvePartnerShops(
  userId: string,
  requestedShopId?: string | null,
  level: ShopAccessLevel = "manage",
): Promise<{ shops: PartnerShopRef[]; activeShop: PartnerShopRef | null }> {
  const rows = await listAccessibleShops(userId, level);

  // Varsayilan: en yeni AKTIF dukkan. Uc dukkanli esnaf onay bekleyen yeni basvurusuyla
  // aciliyordu; misafiri ve valizi olan dukkan ikinci siradaydi (2026-11-19, emulator).
  const requested = requestedShopId?.trim();
  const fallback = rows.find((s) => s.isActive) ?? rows[0];
  const pick = (requested ? rows.find((s) => s.id === requested) : undefined) ?? fallback;
  return { shops: rows, activeShop: pick ?? null };
}
