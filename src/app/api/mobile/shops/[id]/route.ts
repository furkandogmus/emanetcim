import { NextResponse } from "next/server";
import { markAuthStale, resolveMobileShopViewer } from "@/lib/mobile-auth";
import type { ShopViewer } from "@/lib/public-shop-filter";
import { ShopService } from "@/services/ShopService";
import { toMobilePriceBySize, toMobilePricing, toMobilePublicGallery, toMobileShop } from "@/lib/mobile-dto";
import { shopGalleryService } from "@/services/ShopGalleryService";
import { getPricingRules } from "@/lib/platform-settings";
import { todayInZone } from "@/lib/stay-days";
import { loadScheduleParts } from "@/services/ShopScheduleService";
import { prelaunchInterestService } from "@/services/PrelaunchInterestService";

const shopService = new ShopService();

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { viewer, stale } = await resolveMobileShopViewer(req);
  return markAuthStale(await detail((await params).id, viewer), stale);
}

async function detail(id: string, viewer: ShopViewer) {
  /*
    FILTRELI OKUMA (2026-08-31). `getShopDetails` filtresizdi, yani bu KIMLIKSIZ
    uc test dukkanlarini donduruyordu -- "test kaydi kamuya HIC gorunmez"
    kuralinin (P1-4) mobil tasiyicida delindigi yer. Prelaunch noktalari bu
    filtreden GECER: gorunmeleri gerekiyor.
  */
  /*
    Inceleme kum havuzu (2026-11-23): `reviewSandbox` hesap test dukkaninin detayini da
    gorur. Anonim ve gercek kullanici icin filtre aynen PUBLIC_SHOP_FILTER.
  */
  const s = await shopService.getPublicShopById(id, viewer);
  if (!s) return NextResponse.json({ error: "not_found" }, { status: 404 });
  /*
    `isVerified` bu uctan EKSIKTI: liste yaniti tasiyordu, detay tasimiyordu —
    mobil uygulama ayni dukkani listede "dogrulanmis", detayda dogrulanmamis
    gosteriyordu. Ortak govde farki kapatti.
  */
  /*
    `pricing` yalnizca detayda: odeme ekrani bu uctan okuyor ve tahmini tutari
    sunucunun kurallariyla hesapliyor (bkz. `toMobilePricing`).
  */
  const [rules, scheduleParts, images, wantCount] = await Promise.all([
    getPricingRules(),
    loadScheduleParts([s.id], todayInZone()),
    shopGalleryService.list(s.id),
    // Talep testi noktasinda "N kisi istedi" (web detay sayfasiyla ayni sayi); sayac hatasi detayi dusurmez.
    s.isPrelaunch ? prelaunchInterestService.wantCount(s.id).catch(() => 0) : Promise.resolve(null),
  ]);
  const parts = scheduleParts.get(s.id);
  return NextResponse.json({
    ...toMobileShop(s, { weekly: parts?.weekly ?? [], closures: parts?.closures ?? [] }),
    pricing: toMobilePricing(rules),
    // Boyut basina gunluk fiyat sunucudan, yuvarlanmis: istemci carpan uygulamaz.
    priceBySize: toMobilePriceBySize(s.pricePerDay, rules),
    // Kapak `image`da; galeri onun ardindan kaydirilir.
    gallery: toMobilePublicGallery(images),
    prelaunchWantCount: wantCount,
  });
}
