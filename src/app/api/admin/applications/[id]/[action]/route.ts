import { NextResponse } from "next/server";
import { getMobileSession } from "@/lib/mobile-auth";
import { shopService } from "@/services/ShopService";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string; action: string }> }
) {
  const session = await getMobileSession();
  if (!session || session.role !== "ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id, action } = await params;

  /*
    HER IKI ISLEM DE SERVIS UZERINDEN (2026-09-01).

    ONAY: burasi ham `prisma.shop.update({ isActive: true })` yaziyordu --
    dukkani aciyor ama esnafa HICBIR SEY SOYLEMIYORDU. `ShopService.approveShop`
    ayni isi yaparken onay e-postasini gonderiyor, eski kayitlarin
    dogrulanmamis e-postasini isaretliyor ve HICBIR kanal yoksa uyari
    logluyor. Web tarafi (`approveShopAction`) zaten servisi cagiriyordu ve
    oradaki yorum bunun P1-3'te bir kez duzeltildigini yaziyor -- ayni hata
    mobil ucta hic duzeltilmemisti. Yani mobilden onaylanan esnaf, panelinin
    acildigini ogrenemiyordu.

    RED: govde `ShopService.rejectShop`a tasindi; web kopyasi muhurleri stoga
    dondurmuyordu (bkz. o metodun yorumu).
  */
  if (action === "approve") {
    const ok = await shopService.approveShop(id);
    if (!ok) {
      return NextResponse.json({ error: "Shop not found." }, { status: 404 });
    }
  } else if (action === "reject") {
    const result = await shopService.rejectShop(id);
    if (!result.ok) {
      return result.reason === "not_found"
        ? NextResponse.json({ error: "Shop not found." }, { status: 404 })
        : NextResponse.json(
            { error: "Shop has active bookings; cannot delete." },
            { status: 409 },
          );
    }
  } else {
    return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  }

  return NextResponse.json({ success: true });
}
