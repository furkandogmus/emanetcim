import type { NextRequest } from "next/server";
import { requireMobileUser, requireRole } from "@/lib/mobile-auth";
import { clientIpFromRequest } from "@/lib/client-ip";
import { applicationActionResponse } from "@/lib/admin-application-response";

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
  return applicationActionResponse(id, action, {
    userId: auth.user.id,
    ip: clientIpFromRequest(req),
  });
}
