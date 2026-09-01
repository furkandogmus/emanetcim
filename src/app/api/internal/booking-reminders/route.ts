import { NextRequest, NextResponse } from "next/server";
import { authorizeCron } from "@/lib/internal-api-guard";
import prisma from "@/lib/db";
import { withJobRun } from "@/lib/jobs/run-ledger";
import logger from "@/lib/logger";
import { notificationService } from "@/services/NotificationService";
import {
  shouldSendOverdueNotice,
  OVERDUE_NOTICE_SUBJECT_PREFIX,
} from "@/lib/overdue-notice";
import { bookingShortCode } from "@/lib/booking-code";

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

    /*
      3. Check-out saati gecmis CHECKED_IN rezervasyonlar -- ESNAF uyarisi.

      TEKRAR KONTROLU EKLENDI (2026-09-01). Onceki hal yalnizca "cikis saati
      30dk'dan once gecmis" diyordu ve bu is GUNDE BIR calisiyor: ayni valiz
      icin esnafa HER GUN, SURESIZ ayni e-posta gidiyordu. Bir ay unutulmus
      valiz = otuz ozdes e-posta.

      Zarari gurultu degil: esnafi platform e-postalarini gormezden gelmeye
      alistirir, ve o aliskanlik YENI REZERVASYON bildirimini de oldurur --
      esnafin isini baslatan tek seyi.

      Dogru kalip ayni kod tabaninda ZATEN vardi: `OverdueBookingService`
      acikca idempotent ve esiklerle calisiyor. Niyet tekti, iki yerden
      yalnizca birinde uygulanmisti. Artik en fazla BES uyari gider
      (0,5sa / 24sa / 72sa / 1hf / 1ay) -- bkz. `src/lib/overdue-notice.ts`.
    */
    const OVERDUE_SCAN_LIMIT = 100;
    const overdue = await prisma.booking.findMany({
      where: {
        status: "CHECKED_IN",
        checkOutTime: { lt: new Date(now.getTime() - 30 * 60 * 1000) },
      },
      include: { shop: { include: { owner: { select: { email: true, phone: true } } } } },
      /*
        SIRALAMA EKLENDI: `take` siniri asildiginda HANGI kayitlarin dusecegi
        onceden belirsizdi. En cok gecikmis olan en cok ihtiyaci olandir.
      */
      orderBy: { checkOutTime: "asc" },
      take: OVERDUE_SCAN_LIMIT,
    });

    /*
      SESSIZ KESILME GORUNUR OLDU. Sinir asilirsa kalan rezervasyonlar bu
      calismada hic islenmiyordu ve bunu soyleyen hicbir sey yoktu.
    */
    if (overdue.length === OVERDUE_SCAN_LIMIT) {
      logger.warn(
        { limit: OVERDUE_SCAN_LIMIT },
        "booking_reminders_overdue_limit_reached",
      );
    }

    for (const booking of overdue) {
      const partnerEmail = booking.shop.owner?.email;
      if (!partnerEmail) continue;

      const overdueHours =
        (now.getTime() - booking.checkOutTime.getTime()) / 3_600_000;
      const alreadySent = await prisma.notificationLog.count({
        where: {
          bookingId: booking.id,
          type: "EMAIL",
          subject: { startsWith: OVERDUE_NOTICE_SUBJECT_PREFIX },
        },
      });
      if (!shouldSendOverdueNotice(overdueHours, alreadySent)) continue;

      void notificationService.sendEmail(
        partnerEmail,
        `${OVERDUE_NOTICE_SUBJECT_PREFIX} — ${booking.shop.name} ⏰`,
        `Merhaba,\n\nAşağıdaki rezervasyonun check-out saati geçti ancak valiz henüz teslim alınmamış:\n\nRezervasyon Kodu: ${bookingShortCode(booking.id)}\nPlanlanan check-out: ${booking.checkOutTime.toLocaleString("tr-TR")}\n\nLütfen misafir ile iletişime geçin.`,
        booking.id,
      ).catch((e) => logger.warn({ err: e, bookingId: booking.id }, "reminder_overdue_email_failed"));
      results.overdueNotifications++;
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
