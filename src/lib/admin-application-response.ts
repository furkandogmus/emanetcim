import { NextResponse } from "next/server";
import { shopService } from "@/services/ShopService";
import type { ApplicationActor } from "@/services/ShopService";

/**
 * Esnaf basvurusu onay/red ucunun ORTAK govdesi: `api/admin/applications` ve
 * `api/mobile/admin/applications` ayni kodu iki kez yaziyordu ve ikisi de
 * denetim kaydi atliyordu. Yanit `error` alani istemcinin cevirdigi KODDUR,
 * cumle degil (once "Shop not found." donuyordu; uygulama cevirememisti).
 */
export async function applicationActionResponse(
  shopId: string,
  action: string,
  actor: ApplicationActor,
): Promise<NextResponse> {
  if (action === "approve") {
    const result = await shopService.approveApplication(shopId, actor);
    if (!result.ok) {
      return result.reason === "missing_coordinates"
        ? NextResponse.json({ error: "missing_coordinates" }, { status: 409 })
        : NextResponse.json({ error: "not_found" }, { status: 404 });
    }
    return NextResponse.json({ success: true });
  }
  if (action === "reject") {
    const result = await shopService.rejectApplication(shopId, actor);
    if (!result.ok) {
      return result.reason === "not_found"
        ? NextResponse.json({ error: "not_found" }, { status: 404 })
        : NextResponse.json({ error: "has_active_bookings" }, { status: 409 });
    }
    return NextResponse.json({ success: true });
  }
  return NextResponse.json({ error: "invalid_action" }, { status: 400 });
}
