import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { clientIp } from "@/lib/internal-api-guard";
import { forbidWhileImpersonating, requireMobileUser, requireRole } from "@/lib/mobile-auth";
import { opsError, readOpsBody } from "@/lib/mobile-admin-ops-http";
import { revalidatePathAllLocales } from "@/lib/revalidate-locales";
import { campaignService } from "@/services/CampaignService";

type Params = { params: Promise<{ id: string }> };

/** PATCH: duzenle ya da yalniz `{ isActive }` ile duraklat/surdur. Govdede olmayan alan dokunulmaz. */
export async function PATCH(req: NextRequest, { params }: Params) {
  const auth = await requireMobileUser(req);
  if ("error" in auth) return auth.error;
  const forbid = forbidWhileImpersonating(auth.user) ?? requireRole(auth.user, ["ADMIN"]);
  if (forbid) return forbid;
  const { id } = await params;
  const body = await readOpsBody(req);
  const allowed = ["name", "message", "discountPercent", "isActive", "endsAt"] as const;
  const patch = Object.fromEntries(allowed.filter((k) => k in body).map((k) => [k, body[k]]));
  if (Object.keys(patch).length === 0) return opsError("invalid_data");
  const result = await campaignService.update(auth.user, id, patch, { ip: clientIp(req) });
  if (!result.ok) return opsError(result.reason);
  revalidatePathAllLocales("/admin/campaigns");
  return NextResponse.json({ success: true });
}

export async function DELETE(req: NextRequest, { params }: Params) {
  const auth = await requireMobileUser(req);
  if ("error" in auth) return auth.error;
  const forbid = forbidWhileImpersonating(auth.user) ?? requireRole(auth.user, ["ADMIN"]);
  if (forbid) return forbid;
  const { id } = await params;
  const result = await campaignService.remove(auth.user, id, { ip: clientIp(req) });
  if (!result.ok) return opsError(result.reason);
  revalidatePathAllLocales("/admin/campaigns");
  return NextResponse.json({ success: true });
}
