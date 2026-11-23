import prisma from "@/lib/db";
import { APP_STORES_OFF, type AppStoreFlags } from "@/lib/app-stores-shared";

export * from "@/lib/app-stores-shared";

let cache: { flags: AppStoreFlags; at: number } | null = null;
const TTL_MS = 60_000;

/**
 * Bayraklari okur. ASLA FIRLATMAZ: misafir yuzeyleri (kok layout metadata'si,
 * altbilgi, e-posta) icin "bilinmiyor" = "kapali" — bir veritabani hatasi
 * rozet gostermemeli ama sayfayi da dusurmemeli. Build ortaminin veritabani
 * yok; orada da kapali doner. Hata sonucu da TTL boyunca onbellekte kalir,
 * yani build sirasinda her sayfa ayni baglanti hatasini yeniden beklemez.
 */
export async function getAppStoreFlags(): Promise<AppStoreFlags> {
  if (cache && Date.now() - cache.at < TTL_MS) return cache.flags;
  let flags: AppStoreFlags;
  try {
    const row = await prisma.platformSettings.findUnique({
      where: { id: "default" },
      select: { iosAppStoreLive: true, androidPlayLive: true },
    });
    flags = {
      iosAppStoreLive: row?.iosAppStoreLive ?? false,
      androidPlayLive: row?.androidPlayLive ?? false,
    };
  } catch {
    flags = { ...APP_STORES_OFF };
  }
  cache = { flags, at: Date.now() };
  return flags;
}

export function invalidateAppStoreFlagsCache(): void {
  cache = null;
}
