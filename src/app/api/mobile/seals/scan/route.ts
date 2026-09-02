import { canOperateBookingAtShop } from "@/services/booking/access";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { z } from "zod";
import { requireMobileUser, requireRole } from "@/lib/mobile-auth";
import prisma from "@/lib/db";
import { verifyQrToken } from "@/lib/qr-token";

const schema = z.object({ code: z.string().min(1) });

/**
 * Esnaf QR tarama: iki mod
 *   1. Booking QR token → booking detayı döndür (check-in/out için)
 *   2. Seal serial (sayı) → seal kaydı döndür
 */
export async function POST(req: NextRequest) {
  const auth = await requireMobileUser(req);
  if ("error" in auth) return auth.error;
  const forbid = requireRole(auth.user, ["PARTNER", "ADMIN"]);
  if (forbid) return forbid;

  const body = await req.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "invalid" }, { status: 400 });

  const { code } = parsed.data;

  // 1. Seal serial number (numeric)
  const serial = Number(code);
  if (Number.isInteger(serial) && serial > 0) {
    const seal = await prisma.seal.findUnique({ where: { serialNumber: serial } });
    if (seal) {
      return NextResponse.json({
        type: "seal",
        serialNumber: seal.serialNumber,
        status: seal.status,
        shopId: seal.shopId,
        assignedAt: seal.assignedAt,
      });
    }
  }

  // 2. Booking QR token (imzalı)
  try {
    const payload = await verifyQrToken(code);
    if (payload?.bookingId) {
      const booking = await prisma.booking.findUnique({
        where: { id: payload.bookingId },
        include: { shop: true, guest: { select: { name: true } } },
      });
      if (!booking) return NextResponse.json({ error: "not_found" }, { status: 404 });
      // Dukkan operasyonu: kural `booking/access.ts`te, uc yerde degil.
      if (!canOperateBookingAtShop(booking, auth.user)) {
        return NextResponse.json({ error: "forbidden" }, { status: 403 });
      }
      return NextResponse.json({
        type: "booking",
        id: booking.id,
        status: booking.status,
        shopName: booking.shop.name,
        guestName: booking.guest?.name ?? "",
        checkInTime: booking.checkInTime,
        checkOutTime: booking.checkOutTime,
      });
    }
  } catch {
    // ignore
  }

  return NextResponse.json({ error: "unknown_code" }, { status: 404 });
}
