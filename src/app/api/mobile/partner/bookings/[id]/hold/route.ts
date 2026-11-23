import type { NextRequest } from "next/server";
import { requireMobileUser } from "@/lib/mobile-auth";
import { closureResponse } from "@/lib/booking-closure-http";
import { holdLateBooking } from "@/services/booking/late-hold";

/**
 * POST `{}` -> "Misafiri bekle": gec kalan misafirin otomatik kapanisini 30 dk ileri
 * alir. Birakma saatinden once `too_early`, alma saatine dayandiysa `hold_limit`.
 */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireMobileUser(req);
  if ("error" in auth) return auth.error;
  const { id } = await params;
  return closureResponse(await holdLateBooking(id, auth.user));
}
