import { NextResponse } from "next/server";
import { ShopService } from "@/services/ShopService";
import { toMobileShop } from "@/lib/mobile-dto";

const shopService = new ShopService();

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const s = await shopService.getShopDetails(id);
  if (!s) return NextResponse.json({ error: "not_found" }, { status: 404 });
  /*
    `isVerified` bu uctan EKSIKTI: liste yaniti tasiyordu, detay tasimiyordu —
    mobil uygulama ayni dukkani listede "dogrulanmis", detayda dogrulanmamis
    gosteriyordu. Ortak govde farki kapatti.
  */
  return NextResponse.json(toMobileShop(s));
}
