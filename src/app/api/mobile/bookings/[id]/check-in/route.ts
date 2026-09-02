import { DEFAULT_NOTIFICATION_LOCALE } from "@/lib/request-locale";
import { canOperateBookingAtShop } from "@/services/booking/access";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { requireMobileUser, requireRole } from "@/lib/mobile-auth";
import { bookingService } from "@/services/BookingService";
import { notificationService } from "@/services/NotificationService";
import prisma from "@/lib/db";
import { parseCheckInSeals } from "@/lib/seal-payload";
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

  /**
   * Mühür gövdesi DOĞRULANIR — eskiden `body` olduğu gibi servise geçiyordu.
   *
   * `if (body?.sealAssignments) sealPayload = body` doğruluk sınaması bile
   * değildi: dizi olmayan bir değer (`"x"`) testi geçiyor, `.length` 1 dönüyor
   * ve valizle mühür sayısı "eşleşmiş" sayılıyordu. `bagSize` sütunu düz
   * `String`, `bagIndex` sınırsız — veritabanı hiçbirini engellemiyor. Web
   * tarafıyla aynı şema kullanılır ki iki uç farklı şeyi kabul etmesin.
   */
  let rawSeals: unknown;
  try {
    const body = await req.json();
    if (body && typeof body === "object" && "sealAssignments" in body) {
      rawSeals = body;
    }
  } catch {
    // Gövde yok veya JSON değil — mühürsüz check-in denemesi.
  }

  const parsedSeals = parseCheckInSeals(rawSeals);
  if (!parsedSeals.ok) {
    return NextResponse.json(
      { error: "SEAL_INVALID", message: "Mühür bilgisi geçersiz." },
      { status: 400 },
    );
  }
  const sealPayload = parsedSeals.value;

  const booking = await prisma.booking.findUnique({
    where: { id },
    // `locale`: bildirim MISAFIRIN dilinde gider; bkz. `Booking.locale`.
    select: { shop: { select: { ownerId: true } }, guestEmail: true, guestId: true, locale: true },
  });
  if (!booking) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }
  // Dukkan operasyonu: esnaf ya da admin; misafir haric. Kural tek yerde.
  if (!canOperateBookingAtShop(booking, auth.user)) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  // Aktör: dükkanda tahsilat modunda check-in "parayı aldım" beyanıdır (P1-9).
  const result = await bookingService.checkIn(id, sealPayload, {
    id: auth.user.id,
    role: auth.user.role,
  });

  if (!result.ok) {
    /* Ham servis METNI gonderilmez; istemci kodu kendi dilinde eslesir. */
    return NextResponse.json({ error: result.code }, { status: 400 });
  }

  // Send check-in notification to guest
  /*
    Alici kurali servistedir: bu uc `booking.guestEmail`e bakiyordu, web ise
    `booking.guest?.email`e — biri hesapsiz, digeri hesapli misafiri atliyordu.
    Hata artik yutulmuyor: bildirim gitmediyse sebebi loglarda olmali.
  */
  const recipient = bookingNotificationEmail(booking);
  if (recipient) {
    void notificationService
      .notifyCheckIn(recipient, id, booking.locale ?? DEFAULT_NOTIFICATION_LOCALE)
      .catch((err) => logger.error({ err, bookingId: id }, "mobile_checkin_notify_failed"));
  }

  return NextResponse.json({ ok: true });
}
