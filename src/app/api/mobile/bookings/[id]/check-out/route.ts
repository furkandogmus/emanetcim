import { DEFAULT_NOTIFICATION_LOCALE } from "@/lib/request-locale";
import { canOperateBookingAtShop } from "@/services/booking/access";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { requireMobileUser } from "@/lib/mobile-auth";
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
  

  const { id } = await params;

  const booking = await prisma.booking.findUnique({
    where: { id },
    // `locale`: bildirim MISAFIRIN dilinde gider; bkz. `Booking.locale`.
    select: { shop: { select: { id: true, ownerId: true } }, guestEmail: true, locale: true },
  });
  if (!booking) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }
  // Dukkan operasyonu: esnaf ya da admin; misafir haric. Kural tek yerde.
  if (!(await canOperateBookingAtShop(booking, auth.user))) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  // Govde istege bagli: eski uygulama bos gonderir.
  const body = (await req.json().catch(() => null)) as { brokenSealNumbers?: unknown } | null;
  const brokenSealNumbers = Array.isArray(body?.brokenSealNumbers)
    ? body.brokenSealNumbers.filter((n): n is number => Number.isInteger(n) && n > 0).slice(0, 50)
    : [];
  const result = await bookingService.checkOut(id, {
    brokenSealNumbers,
    actor: { id: auth.user.id, role: auth.user.role, impersonatedBy: auth.user.impersonatedBy ?? null },
  });

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
      .notifyCheckOut(recipient, id, booking.locale ?? DEFAULT_NOTIFICATION_LOCALE)
      .catch((err) => logger.error({ err, bookingId: id }, "mobile_checkout_notify_failed"));
  } else {
    notificationService.pushGuestOnly(id, "checkOut", booking.locale ?? DEFAULT_NOTIFICATION_LOCALE);
  }

  return NextResponse.json({
    ok: true,
    refundPending: result.refundPending,
    refundAmount: result.refundAmount,
    // Tezgahta misafirden alinacak gecikme ucreti (0 ise alan yok).
    lateFee: result.lateFee,
  });
}
