import prisma from "@/lib/db";
import type { BookingEventType } from "@/services/BookingEventService";
import logger from "@/lib/logger";
import { runWithConcurrency } from "@/lib/run-with-concurrency";
import { notificationService } from "@/services/NotificationService";
import { bookingNotificationEmail } from "@/services/booking/guest-contact";
import { bookingTimeZone } from "@/lib/format-datetime";
import { DEFAULT_NOTIFICATION_LOCALE } from "@/lib/request-locale";
import {
  nextOverdueGuestReminderSlot,
  overdueGuestReminderSlotOffsetMs,
  OVERDUE_GUEST_REMINDER_MAX,
  OVERDUE_GUEST_REMINDER_INTERVAL_HOURS,
} from "@/lib/overdue-guest-reminder";

/** `BookingEvent.event` degeri; `metadata.slot` kacinci hatirlatma oldugunu tutar. */
export const OVERDUE_GUEST_REMINDER_EVENT = "OVERDUE_GUEST_REMINDER" satisfies BookingEventType;

/**
 * Taramanin alt siniri: son slotun vakti + bir aralik (144 + 24 = 168 sa). Bunun
 * otesindeki rezervasyonun gonderilecek slotu yoktur. Sinir olmasaydi yedi slotunu
 * bitirmis ve prod'daki eski, kapatilmamis CHECKED_IN kayitlari (`scripts/repair-stale-checkin.sh`)
 * `checkOutTime asc` siralamasinda ilk 100'u kalici olarak doldurur, yeni gecikmis
 * misafir hic taranmazdi; yayin aninda aylik kayitlara "valiziniz bekliyor" da giderdi.
 */
export const OVERDUE_GUEST_REMINDER_LOOKBACK_MS =
  overdueGuestReminderSlotOffsetMs(OVERDUE_GUEST_REMINDER_MAX) +
  OVERDUE_GUEST_REMINDER_INTERVAL_HOURS * 3_600_000;

/** Ayni anda islenen rezervasyon sayisi. */
export const OVERDUE_GUEST_REMINDER_CONCURRENCY = 5;

export type OverdueGuestReminderReport = {
  scanned: number;
  /** En az bir kanaldan (push ya da e-posta) gercekten ulasan hatirlatma. */
  sent: number;
  /** Slot sahiplenildi ama hicbir kanal basarili donmedi (cihaz yok, saglayici reddetti). */
  undelivered: number;
  /**
   * Ne e-postasi ne hesabi (push alicisi) olan rezervasyon: slot SAHIPLENILMEZ, sayilmaz.
   * Ulasilacak bir kanal olmadan slot yazmak, defterde "bildirildi" yalanini birakirdi.
   */
  noChannel: number;
  /** Baska bir calisma ayni slotu once sahiplendi ya da rezervasyon kilit altinda kapandi. */
  lostRace: number;
  limitReached: boolean;
};

function slotOf(metadata: unknown): number | null {
  if (metadata && typeof metadata === "object" && "slot" in metadata) {
    const s = (metadata as { slot: unknown }).slot;
    return typeof s === "number" ? s : null;
  }
  return null;
}

/**
 * Alma saati gecmis CHECKED_IN rezervasyonlarin MISAFIRINE hatirlatma
 * (takvim: `src/lib/overdue-guest-reminder.ts`). `booking-reminders` isi cagirir.
 *
 * TEKRAR KORUMASI `BookingEvent` uzerinden ve GONDERIMDEN ONCE: slot, rezervasyon
 * basina `pg_advisory_xact_lock` altinda once yazilir (sahiplenilir), sonra gonderilir.
 * Es zamanli iki calisma ayni slotu iki kez sahiplenemez; surec gonderim sirasinda
 * duserse o slot kaybolur, iki kez gitmez. Eski `NotificationLog` konu oneki sayimi
 * yalnizca Turkce konuyu taniyordu: diger dillerde sayac hep 0 kaliyor ve misafire
 * her 15 dakikada bir e-posta gidiyordu.
 *
 * Durum DEGISTIRMEZ (bkz. `OverdueBookingService`).
 */
export class OverdueGuestReminderService {
  async run(opts: { now?: Date; limit?: number } = {}): Promise<OverdueGuestReminderReport> {
    const now = opts.now ?? new Date();
    const limit = opts.limit ?? 100;

    const bookings = await prisma.booking.findMany({
      where: {
        status: "CHECKED_IN",
        checkOutTime: {
          gte: new Date(now.getTime() - OVERDUE_GUEST_REMINDER_LOOKBACK_MS),
          lte: new Date(now.getTime() - overdueGuestReminderSlotOffsetMs(1)),
        },
      },
      select: {
        id: true,
        guestId: true,
        guestEmail: true,
        locale: true,
        checkOutTime: true,
        guest: { select: { email: true } },
        shop: {
          select: {
            name: true,
            address: true,
            openingTime: true,
            closingTime: true,
            open247: true,
            timezone: true,
          },
        },
      },
      // En cok gecikmis olan en cok ihtiyaci olandir: sinira dayanildiginda dusen o olmasin.
      orderBy: { checkOutTime: "asc" },
      take: limit,
    });
    const limitReached = bookings.length === limit;
    if (limitReached) logger.warn({ limit }, "overdue_guest_reminder_limit_reached");

    const events =
      bookings.length === 0
        ? []
        : await prisma.bookingEvent.findMany({
            where: { bookingId: { in: bookings.map((b) => b.id) }, event: OVERDUE_GUEST_REMINDER_EVENT },
            select: { bookingId: true, metadata: true },
          });
    const sentSlots = new Map<string, number[]>();
    for (const e of events) {
      const s = slotOf(e.metadata);
      if (s == null) continue;
      sentSlots.set(e.bookingId, [...(sentSlots.get(e.bookingId) ?? []), s]);
    }

    let sent = 0;
    let undelivered = 0;
    let noChannel = 0;
    let lostRace = 0;
    // Sirali await 100 x 8 sn e-posta zaman asimiyla `call-internal-job.sh`in 120 sn
    // `--max-time` sinirini asabilir. Kilit rezervasyon basina; havuz onu degistirmez.
    await runWithConcurrency(bookings, OVERDUE_GUEST_REMINDER_CONCURRENCY, async (b) => {
      const slot = nextOverdueGuestReminderSlot(
        now.getTime() - b.checkOutTime.getTime(),
        sentSlots.get(b.id) ?? [],
      );
      if (slot == null) return;

      const email = bookingNotificationEmail(b);
      if (email == null && b.guestId == null) {
        noChannel++;
        return;
      }
      const claimed = await this.claimSlot(b.id, slot, { email: email != null, push: b.guestId != null });
      if (!claimed) {
        lostRace++;
        return;
      }

      try {
        const outcome = await notificationService.sendOverdueGuestReminder({
          bookingId: b.id,
          email,
          hasAccount: b.guestId != null,
          locale: b.locale ?? DEFAULT_NOTIFICATION_LOCALE,
          checkOutAt: b.checkOutTime,
          shop: {
            name: b.shop.name,
            address: b.shop.address,
            openingTime: b.shop.openingTime,
            closingTime: b.shop.closingTime,
            open247: b.shop.open247,
            timeZone: bookingTimeZone(b.shop),
          },
          now,
        });
        if (outcome.push || outcome.email) sent++;
        else undelivered++;
      } catch (err) {
        // Slot sahiplenildi: tekrar denenmez (iki kez gitmesindense bir kez eksik gitsin).
        undelivered++;
        logger.warn({ err, bookingId: b.id, slot }, "overdue_guest_reminder_send_failed");
      }
    });

    return { scanned: bookings.length, sent, undelivered, noChannel, lostRace, limitReached };
  }

  /**
   * Slotu kilit altinda sahiplenir. Kilit icinde YENIDEN okunur: durum (arada teslim
   * edildiyse ya da iptal olduysa gonderme) ve yazilmis slotlar (baska calisma onde).
   */
  private async claimSlot(
    bookingId: string,
    slot: number,
    channels: { email: boolean; push: boolean },
  ): Promise<boolean> {
    return prisma.$transaction(async (tx) => {
      const lockKey = `overdue-guest-reminder:${bookingId}`;
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${lockKey})::bigint)`;

      const booking = await tx.booking.findUnique({ where: { id: bookingId }, select: { status: true } });
      if (booking?.status !== "CHECKED_IN") return false;

      const existing = await tx.bookingEvent.findMany({
        where: { bookingId, event: OVERDUE_GUEST_REMINDER_EVENT },
        select: { metadata: true },
      });
      if (existing.some((e) => (slotOf(e.metadata) ?? 0) >= slot)) return false;

      await tx.bookingEvent.create({
        data: { bookingId, event: OVERDUE_GUEST_REMINDER_EVENT, metadata: { slot, ...channels } },
      });
      return true;
    });
  }
}

export const overdueGuestReminderService = new OverdueGuestReminderService();
