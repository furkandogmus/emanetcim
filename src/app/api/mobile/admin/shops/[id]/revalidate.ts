import logger from "@/lib/logger";
import { revalidatePathAllLocales } from "@/lib/revalidate-locales";

/**
 * Yonetici dukkan icerigini (fotograf, saat, yorum) degistirince misafir sayfasi
 * ve web admin duzenleme ekrani bayat kalmasin. Hata yutulur ve loglanir:
 * yazma zaten tamamlandi, onbellek bir sonraki istekte tazelenir.
 */
export function revalidateShopContent(shopId: string): void {
  try {
    revalidatePathAllLocales(`/shop/${shopId}`);
    revalidatePathAllLocales(`/admin/partners/${shopId}/edit`);
    revalidatePathAllLocales("/search");
  } catch (err) {
    logger.error({ shopId, err }, "revalidate_after_admin_shop_content_failed");
  }
}
