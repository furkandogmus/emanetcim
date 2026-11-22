import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { clientIp } from "@/lib/internal-api-guard";
import { forbidWhileImpersonating, requireMobileUser, requireRole } from "@/lib/mobile-auth";
import { toMobileAdminDispute } from "@/lib/mobile-dto";
import { opsError, readOpsBody } from "@/lib/mobile-admin-ops-http";
import { disputeService } from "@/services/DisputeService";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(req: NextRequest, { params }: Ctx) {
  const auth = await requireMobileUser(req);
  if ("error" in auth) return auth.error;
  const forbid = requireRole(auth.user, ["ADMIN"]) ?? forbidWhileImpersonating(auth.user);
  if (forbid) return forbid;
  const { id } = await params;
  const row = await disputeService.getForAdmin(id);
  if (!row) return opsError("not_found");
  return NextResponse.json(toMobileAdminDispute(row));
}

/** PATCH `{ status, adminNote }`. Govde `DisputeService.updateStatus` (web action da onu cagirir). */
export async function PATCH(req: NextRequest, { params }: Ctx) {
  const auth = await requireMobileUser(req);
  if ("error" in auth) return auth.error;
  const forbid = requireRole(auth.user, ["ADMIN"]) ?? forbidWhileImpersonating(auth.user);
  if (forbid) return forbid;
  const { id } = await params;
  const { status, adminNote } = await readOpsBody(req);
  const result = await disputeService.updateStatus(auth.user, id, status, adminNote, { ip: clientIp(req) });
  if (!result.ok) return opsError(result.reason);
  const row = await disputeService.getForAdmin(id);
  if (!row) return opsError("not_found");
  return NextResponse.json(toMobileAdminDispute(row));
}
