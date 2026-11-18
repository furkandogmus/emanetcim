import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { z } from "zod";
import prisma from "@/lib/db";
import { requireMobileUser } from "@/lib/mobile-auth";
import { bookingService } from "@/services/BookingService";

/**
 * Misafirin bekleyen valiz duzeltmesini onaylamasi ya da reddetmesi (2026-11-18).
 *
 * Web'deki `approveBagRevisionAction` / `rejectBagRevisionAction` ile ayni govde:
 * `applyBagRevision` / `clearBagRevision`. Mobil misafir onceden bunu yalnizca
 * e-postadaki baglantiyla yapabiliyordu.
 */
/*
  `expectedNewTotal`: misafirin kartta GORDUGU yeni toplam. Esnaf kart acikken
  oneriyi yeniden yazarsa (+₺50 -> +₺500) eski karttaki "Onayla" yeni tutari
  uygulamasin. Eski uygulama gondermez; o zaman eski davranis.
*/
const schema = z.object({
  action: z.enum(["approve", "reject"]),
  expectedNewTotal: z.number().nonnegative().optional(),
});

const CODE_TO_HTTP: Record<string, { status: number; error: string }> = {
  NOT_FOUND: { status: 404, error: "not_found" },
  FORBIDDEN: { status: 403, error: "forbidden" },
  INVALID_STATUS: { status: 409, error: "invalid_status" },
  NO_PENDING_REVISION: { status: 409, error: "no_pending_revision" },
  CAPACITY_EXCEEDED: { status: 409, error: "insufficient_capacity" },
  SEAL_COUNT_MISMATCH: { status: 409, error: "seal_count_mismatch" },
  INVALID_COUNTS: { status: 400, error: "invalid_counts" },
};

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireMobileUser(req);
  if ("error" in auth) return auth.error;
  const { id } = await params;

  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "invalid_data" }, { status: 400 });

  // Yalnizca rezervasyonun SAHIBI: onay misafirin, esnaf kendi onerisini onaylayamaz.
  const booking = await prisma.booking.findUnique({
    where: { id },
    select: { guestId: true, pendingBagRevision: true },
  });
  if (!booking) return NextResponse.json({ error: "not_found" }, { status: 404 });
  if (booking.guestId !== auth.user.id) return NextResponse.json({ error: "forbidden" }, { status: 403 });

  if (parsed.data.action === "approve" && parsed.data.expectedNewTotal !== undefined) {
    const pending = booking.pendingBagRevision as { newTotal?: unknown } | null;
    const current = typeof pending?.newTotal === "number" ? pending.newTotal : null;
    if (current === null || Math.abs(current - parsed.data.expectedNewTotal) > 0.005) {
      return NextResponse.json({ error: "revision_changed" }, { status: 409 });
    }
  }

  const actor = { id: auth.user.id, role: "GUEST" as const };
  const result =
    parsed.data.action === "approve"
      ? await bookingService.applyBagRevision(id, actor, { source: "mobile" })
      : await bookingService.clearBagRevision(id, actor);

  if (!result.ok) {
    const mapped = CODE_TO_HTTP[result.code] ?? { status: 500, error: "revision_failed" };
    return NextResponse.json({ error: mapped.error }, { status: mapped.status });
  }
  return NextResponse.json({ success: true, newTotal: "newTotal" in result ? result.newTotal : null });
}
