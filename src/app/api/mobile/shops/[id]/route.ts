import { NextResponse } from "next/server";
import { ShopService } from "@/services/ShopService";
import { toMobilePricing, toMobileShop } from "@/lib/mobile-dto";
import { getPricingRules } from "@/lib/platform-settings";

const shopService = new ShopService();

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  /*
    FILTRELI OKUMA (2026-08-31). `getShopDetails` filtresizdi, yani bu KIMLIKSIZ
    uc test dukkanlarini donduruyordu -- "test kaydi kamuya HIC gorunmez"
    kuralinin (P1-4) mobil tasiyicida delindigi yer. Prelaunch noktalari bu
    filtreden GECER: gorunmeleri gerekiyor.
  */
  const s = await shopService.getPublicShopById(id);
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
  const rules = await getPricingRules();
  return NextResponse.json({ ...toMobileShop(s), pricing: toMobilePricing(rules) });
}
