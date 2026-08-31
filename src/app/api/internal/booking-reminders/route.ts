import { NextRequest, NextResponse } from "next/server";
import { authorizeCron } from "@/lib/internal-api-guard";
import prisma from "@/lib/db";
import { withJobRun } from "@/lib/jobs/run-ledger";
import logger from "@/lib/logger";
import { notificationService } from "@/services/NotificationService";

// Booking Reminder Cron
//
// Hatırlatma türleri:
// - CHECK_IN_SOON: 2 saat içinde check-in yapacak misafirler
// - CHECK_OUT_SOON: 1 saat içinde check-out yapacak misafirler
// - CHECK_OUT_OVERDUE: Check-out saati geçmiş aktif booking'ler (partner uyarısı)
//
// Her 15 dakikada bir çalışacak şekilde tasarlanmıştır.
// Vercel Cron: "*/15 * * * *"
export async function GET(req: NextRequest) {
  /*
    ORTAK KAPIYA GECILDI (2026-08-31). Bu dosya `CRON_SECRET` karsilastirmasini
    kendi icinde yaziyordu ve `bearer === secret` kullaniyordu -- yani sabit
    ZAMANLI olmayan bir karsilastirma. `authorizeCron` ayni isi
    `crypto.timingSafeEqual` ile yapiyor ve zaten UC ucta kullaniliyordu; bu dosya
    (ve iki kardesi) kopyada kalmisti. Kopya olmasi, `internal-api-guard.ts`in var
    olma gerekcesinin tam olarak gerceklestigi yer: bir uc duzeltilirken digerleri
    unutuluyor.
  */
  const denial = authorizeCron(req);
  if (denial === "not_configured") {
    return NextResponse.json(
      { ok: false, error: "CRON_SECRET not configured" },
      { status: 503 },
    );
  }
  if (denial) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  const now = new Date();
  const results = {
    checkInReminders: 0,
    checkOutReminders: 0,
    overdueNotifications: 0,
  };

  // Defter kaydi: HTTP 200 donmek yetmiyor, is CALISTIGINI JobRun'a yazmali.
  // Yoksa /api/health/jobs bu isi hic gormez ve enforced=true yapildiginda
  // sonsuza dek "gecikmis" gorunur (2026-08-29: sekiz isten dordu boyleydi).
  const outcome = await withJobRun("booking-reminders", async () => {
    // 1. 2 saat içinde check-in yapacak PAID booking'ler
    const checkInSoon = await prisma.booking.findMany({
      where: {
        status: "PAID",
        checkInTime: { gte: now, lte: new Date(now.getTime() + 2 * 60 * 60 * 1000) },
      },
      include: { guest: { select: { email: true, name: true } }, shop: { select: { name: true } } },
      take: 100,
    });

    for (const booking of checkInSoon) {
      if (booking.guest?.email) {
        void notificationService.sendEmail(
          booking.guest.email,
          "BagajPark: Check-in zamanınız yaklaşıyor! 🎒",
          `Merhaba ${booking.guest.name ?? ""},\n\nBagajınızı ${booking.shop.name} mağazasına teslim etme zamanınız yaklaşıyor.\n\nCheck-in: ${booking.checkInTime.toLocaleString("tr-TR")}\n\nQR kodunuzu göstermeyi unutmayın.`,
          booking.id,
        ).catch((e) => logger.warn({ err: e, bookingId: booking.id }, "reminder_checkin_email_failed"));
        results.checkInReminders++;
      }
    }

    // 2. 1 saat içinde check-out yapacak CHECKED_IN booking'ler
    const checkOutSoon = await prisma.booking.findMany({
      where: {
        status: "CHECKED_IN",
        checkOutTime: { gte: now, lte: new Date(now.getTime() + 1 * 60 * 60 * 1000) },
      },
      include: { guest: { select: { email: true, name: true } }, shop: { select: { name: true } } },
      take: 100,
    });

    for (const booking of checkOutSoon) {
      if (booking.guest?.email) {
        void notificationService.sendEmail(
          booking.guest.email,
          "BagajPark: Valizinizi alma zamanı! 🔔",
          `Merhaba ${booking.guest.name ?? ""},\n\n${booking.shop.name} mağazasındaki bagajınızı teslim alma zamanınız yaklaşıyor.\n\nCheck-out: ${booking.checkOutTime.toLocaleString("tr-TR")}\n\nGeç teslim almalarda ek ücret uygulanabilir.`,
          booking.id,
        ).catch((e) => logger.warn({ err: e, bookingId: booking.id }, "reminder_checkout_email_failed"));
        results.checkOutReminders++;
      }
    }

    // 3. Check-out saati geçmiş CHECKED_IN booking'ler (partner uyarısı)
    const overdue = await prisma.booking.findMany({
      where: {
        status: "CHECKED_IN",
        checkOutTime: { lt: new Date(now.getTime() - 30 * 60 * 1000) },
      },
      include: { shop: { include: { owner: { select: { email: true, phone: true } } } } },
      take: 100,
    });

    for (const booking of overdue) {
      const partnerEmail = booking.shop.owner?.email;
      if (partnerEmail) {
        void notificationService.sendEmail(
          partnerEmail,
          `BagajPark: Geç teslim — ${booking.shop.name} ⏰`,
          `Merhaba,\n\nAşağıdaki rezervasyonun check-out saati geçti ancak valiz henüz teslim alınmamış:\n\nRezervasyon: ${booking.id.slice(0, 8)}\nPlanlanan check-out: ${booking.checkOutTime.toLocaleString("tr-TR")}\n\nLütfen misafir ile iletişime geçin.`,
          booking.id,
        ).catch((e) => logger.warn({ err: e, bookingId: booking.id }, "reminder_overdue_email_failed"));
        results.overdueNotifications++;
      }
    }

    logger.info({ results }, "booking_reminders_cron_completed");
    return { ok: true as const, detail: results };
  });

  if (!outcome.ok) {
    logger.error({ error: outcome.error }, "booking_reminders_cron_failed");
    return NextResponse.json({ ok: false, error: "Internal error" }, { status: 500 });
  }
  return NextResponse.json({ ok: true, results: outcome.detail });
}
