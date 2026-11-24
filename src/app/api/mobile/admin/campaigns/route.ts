import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { clientIp } from "@/lib/internal-api-guard";
import { forbidWhileImpersonating, requireMobileUser, requireRole } from "@/lib/mobile-auth";
import { toMobileAdminCampaign } from "@/lib/mobile-dto";
import { opsError, readOpsBody } from "@/lib/mobile-admin-ops-http";
import { revalidatePathAllLocales } from "@/lib/revalidate-locales";
import { campaignService } from "@/services/CampaignService";

export async function GET(req: NextRequest) {
  const auth = await requireMobileUser(req);
  if ("error" in auth) return auth.error;
  const forbid = requireRole(auth.user, ["ADMIN"]);
  if (forbid) return forbid;
  const rows = await campaignService.listForAdmin();
  return NextResponse.json({ items: rows.map(toMobileAdminCampaign) });
}

/** POST -> 201 `{ id }`. Sema ve denetim kaydi `CampaignService.create`te (web ile ayni). */
export async function POST(req: NextRequest) {
  const auth = await requireMobileUser(req);
  if ("error" in auth) return auth.error;
  const forbid = forbidWhileImpersonating(auth.user) ?? requireRole(auth.user, ["ADMIN"]);
  if (forbid) return forbid;
  const { name, message, discountPercent, isActive, endsAt } = await readOpsBody(req);
  const result = await campaignService.create(
    auth.user,
    { name, message, discountPercent, isActive, endsAt },
    { ip: clientIp(req) },
  );
  if (!result.ok) return opsError(result.reason);
  revalidatePathAllLocales("/admin/campaigns");
  return NextResponse.json({ id: result.id }, { status: 201 });
}
