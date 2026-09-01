import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { z } from "zod";
import { requireMobileUser } from "@/lib/mobile-auth";
import { disputeService } from "@/services/DisputeService";

const disputeSchema = z.object({
  bookingId: z.string().min(1),
  reason: z.enum(["DAMAGE", "THEFT", "OTHER"]),
  description: z.string().min(10).max(2000).trim(),
});

export async function POST(req: NextRequest) {
  const auth = await requireMobileUser(req);
  if ("error" in auth) return auth.error;

  const body = await req.json();
  const parsed = disputeSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid_data", details: parsed.error.flatten() }, { status: 400 });
  }

  const { bookingId, reason, description } = parsed.data;

  /*
    GOVDE `DisputeService`TE (2026-09-01). Burasi yalnizca `dispute.create`
    yapiyordu: rezervasyon zaman cizelgesine `DISPUTED` izi DUSMUYOR ve
    ADMINLERE HIC BILDIRIM GITMIYORDU. Yani mobil uygulamadan acilan bir HASAR
    ya da HIRSIZLIK sikayeti, biri /admin/disputes sayfasini acana kadar
    veritabaninda sessizce bekliyordu.
  */
  const result = await disputeService.create({
    bookingId,
    guestId: auth.user.id,
    reason,
    description,
  });
  if (!result.ok) {
    const STATUS = {
      not_found: 404,
      not_owner: 403,
      booking_not_ready: 400,
      duplicate: 409,
    } as const;
    return NextResponse.json(
      { error: result.reason === "duplicate" ? "duplicate_dispute" : result.reason },
      { status: STATUS[result.reason] },
    );
  }
  return NextResponse.json({ success: true, id: result.id });
}
