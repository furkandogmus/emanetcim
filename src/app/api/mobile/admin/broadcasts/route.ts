import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { clientIp } from "@/lib/internal-api-guard";
import { toMobileAdminBroadcast } from "@/lib/mobile-dto";
import { createBroadcast, listBroadcasts, startBroadcastDelivery } from "@/services/BroadcastService";
import { broadcastError, readObjectBody, forbidWhileImpersonatingBroadcast } from "./http";
import { requireMobileUser, requireRole } from "@/lib/mobile-auth";

/** GET `?limit=20` -> son duyurular (asili SENDING satirlari burada FAILED'a cekilir). */
export async function GET(req: NextRequest) {
  const auth = await requireMobileUser(req);
  if ("error" in auth) return auth.error;
  const forbid = requireRole(auth.user, ["ADMIN"]) ?? forbidWhileImpersonatingBroadcast(auth.user);
  if (forbid) return forbid;
  const rows = await listBroadcasts(req.nextUrl.searchParams.get("limit"));
  return NextResponse.json({ items: rows.map(toMobileAdminBroadcast) });
}

/** POST -> 202 `{ id, devices }`; teslim arka planda surer. */
export async function POST(req: NextRequest) {
  const auth = await requireMobileUser(req);
  if ("error" in auth) return auth.error;
  const forbid = requireRole(auth.user, ["ADMIN"]) ?? forbidWhileImpersonatingBroadcast(auth.user);
  if (forbid) return forbid;
  const body = await readObjectBody(req);
  const result = await createBroadcast(auth.user, body, { ip: clientIp(req) });
  if (!result.ok) {
    return result.code === "too_soon"
      ? broadcastError(result.code, { retryAfterSeconds: result.retryAfterSeconds })
      : broadcastError(result.code);
  }
  startBroadcastDelivery(result.id);
  return NextResponse.json({ id: result.id, devices: result.devices }, { status: 202 });
}
