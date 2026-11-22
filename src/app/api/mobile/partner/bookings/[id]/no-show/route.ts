import type { NextRequest } from "next/server";
import { requireMobileUser } from "@/lib/mobile-auth";
import { closureResponse } from "@/lib/booking-closure-http";
import { markNoShow } from "@/services/booking/closure";

/** POST `{}` -> "misafir gelmedi". check-in + 60 dk'dan once `too_early`. */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireMobileUser(req);
  if ("error" in auth) return auth.error;
  const { id } = await params;
  return closureResponse(await markNoShow(id, auth.user));
}
