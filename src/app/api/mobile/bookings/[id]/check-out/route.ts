import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { requireMobileUser, requireRole } from "@/lib/mobile-auth";
import { bookingService } from "@/services/BookingService";
import { notificationService } from "@/services/NotificationService";
import prisma from "@/lib/db";
import { bookingNotificationEmail } from "@/services/booking/guest-contact";
import logger from "@/lib/logger";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireMobileUser(req);
  if ("error" in auth) return auth.error;
  
  const forbid = requireRole(auth.user, ["PARTNER", "ADMIN"]);
  if (forbid) return forbid;

  const { id } = await params;

  const booking = await prisma.booking.findUnique({
    where: { id },
    select: { shop: { select: { ownerId: true } }, guestEmail: true },
  });
  if (!booking) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }
  if (auth.user.role !== "ADMIN" && booking.shop.ownerId !== auth.user.id) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const result = await bookingService.checkOut(id);

  if (!result.ok) {
    /* Ham servis METNI gonderilmez; istemci kodu kendi dilinde eslesir. */
    return NextResponse.json({ error: result.code }, { status: 400 });
  }

  // Send check-out notification to guest
  /*
    Alici kurali servistedir: bu uc `booking.guestEmail`e bakiyordu, web ise
    `booking.guest?.email`e — biri hesapsiz, digeri hesapli misafiri atliyordu.
    Hata artik yutulmuyor: bildirim gitmediyse sebebi loglarda olmali.
  */
  const recipient = bookingNotificationEmail(booking);
  if (recipient) {
    void notificationService
      .notifyCheckOut(recipient, id)
      .catch((err) => logger.error({ err, bookingId: id }, "mobile_checkout_notify_failed"));
  }

  return NextResponse.json({ 
    ok: true, 
    refundPending: result.refundPending, 
    refundAmount: result.refundAmount 
  });
}
