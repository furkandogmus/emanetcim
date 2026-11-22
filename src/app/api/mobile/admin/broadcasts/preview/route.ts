import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { previewBroadcast } from "@/services/BroadcastService";
import { broadcastError, readObjectBody, forbidWhileImpersonatingBroadcast } from "../http";
import { requireMobileUser, requireRole } from "@/lib/mobile-auth";

/** POST `{ audience }` -> `{ users, devices }`: gonderilirse kac kisiye/cihaza gider. */
export async function POST(req: NextRequest) {
  const auth = await requireMobileUser(req);
  if ("error" in auth) return auth.error;
  const forbid = requireRole(auth.user, ["ADMIN"]) ?? forbidWhileImpersonatingBroadcast(auth.user);
  if (forbid) return forbid;
  const body = await readObjectBody(req);
  const r = await previewBroadcast(body.audience);
  if (!r.ok) return broadcastError(r.code);
  return NextResponse.json({ users: r.users, devices: r.devices });
}
