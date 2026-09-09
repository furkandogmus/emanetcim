import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { requireMobileUser, requireRole } from "@/lib/mobile-auth";
import { shopService } from "@/services/ShopService";

/*
  Mobil admin uygulaması `POST /admin/applications/:id/approve|reject`e
  gidiyordu ama bu mobil-namespace'li uç hiç yoktu (yalnızca GET
  `/admin/applications` vardı) -- her onay/red 404 ile düşüyor, esnaf
  başvurusu asla işlenmiyordu. Gövde web tarafındaki
  `src/app/api/admin/applications/[id]/[action]/route.ts` ile aynı
  `ShopService.approveShop`/`rejectShop` çağrılarını kullanır (kök
  CLAUDE.md: bir iş kuralı web ve mobilde ayrı yazılmaz), yalnızca yetki
  kontrolü mobil deseni olan `requireMobileUser`/`requireRole`'dür.
*/
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; action: string }> }
) {
  const auth = await requireMobileUser(req);
  if ("error" in auth) return auth.error;
  const forbid = requireRole(auth.user, ["ADMIN"]);
  if (forbid) return forbid;

  const { id, action } = await params;

  if (action === "approve") {
    const result = await shopService.approveShop(id);
    if (!result.ok) {
      return result.reason === "missing_coordinates"
        ? NextResponse.json(
            { error: "Shop has no coordinates; set them before approving." },
            { status: 409 },
          )
        : NextResponse.json({ error: "Shop not found." }, { status: 404 });
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
