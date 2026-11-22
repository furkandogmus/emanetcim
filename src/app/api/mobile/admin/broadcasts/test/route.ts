import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { sendBroadcastTest } from "@/services/BroadcastService";
import { broadcastError, readObjectBody, forbidWhileImpersonatingBroadcast } from "../http";
import { requireMobileUser, requireRole } from "@/lib/mobile-auth";

/** POST `{ titleTr, bodyTr, titleEn?, bodyEn? }` -> yalniz cagiranin cihazlarina; `devices: 0` hata degil. */
export async function POST(req: NextRequest) {
  const auth = await requireMobileUser(req);
  if ("error" in auth) return auth.error;
  const forbid = requireRole(auth.user, ["ADMIN"]) ?? forbidWhileImpersonatingBroadcast(auth.user);
  if (forbid) return forbid;
  const body = await readObjectBody(req);
  const r = await sendBroadcastTest(auth.user, body);
  if (!r.ok) {
    return r.code === "too_soon"
      ? broadcastError(r.code, { retryAfterSeconds: r.retryAfterSeconds })
      : broadcastError(r.code);
  }
  return NextResponse.json({ success: true, devices: r.devices });
}
