import type { Prisma } from "@prisma/client";
import prisma from "@/lib/db";
import logger from "@/lib/logger";
import { runWithConcurrency } from "@/lib/run-with-concurrency";
import { bookingTimeZone } from "@/lib/format-datetime";
import { DEFAULT_NOTIFICATION_LOCALE } from "@/lib/request-locale";
import {
  LATE_ACTIONABLE_STATUSES,
  LATE_CLOSE_AFTER_MIN,
  LATE_PARTNER_STAGE,
  NOT_DROPPED_STATUSES,
  isLateActionableStatus,
  isLateHoldActive,
  isSilentBacklog,
  lateCloseAt,
  lateReminderOffsetMs,
  nextLateReminderStage,
} from "@/lib/late-dropoff";
import type { BookingEventType } from "@/services/BookingEventService";
import { notificationService } from "@/services/NotificationService";
import { bookingNotificationEmail } from "@/services/booking/guest-contact";
import { cancelBooking } from "@/services/booking/lifecycle";

export const LATE_DROPOFF_REMINDER_EVENT = "LATE_DROPOFF_REMINDER" satisfies BookingEventType;

export const LATE_DROPOFF_CONCURRENCY = 5;

/**
 * Yeni is baslatmanin son ani. `call-internal-job.sh` 120 sn'de keser; yarim
 * kalan calisma sorun degil (kalanlar 5 dk sonra), ama yanit donmeden kesilen
 * istek `JobRun`'i basarisiz yazar.
 */
export const LATE_DROPOFF_TIME_BUDGET_MS = 90_000;

const MINUTE_MS = 60_000;

export type LateDropoffReport = {
  remindersScanned: number;
  /** Misafire en az bir kanaldan ulasan hatirlatma. */
  remindersSent: number;
  remindersUndelivered: number;
  partnerAlerts: number;
  /** Misafirin ne hesabi ne e-postasi var: asama sahiplenilmez. */
  noChannel: number;
  /** Baska calisma once sahiplendi ya da kilit altinda durum degisti. */
  lostRace: number;
  closeScanned: number;
  closed: number;
  /** Misafir hic uyarilmadi, kapanis cok eski ya da odemesiz niyet: bildirimsiz. */
  closedSilently: number;
  /** Kosullu kilit eslesmedi (arada check-in / bekletme) ya da iptal reddedildi. */
  closeSkipped: number;
  /** Zaman butcesi doldugu icin bu calismada islenmeyen. */
  deferred: number;
  limitReached: boolean;
};

function stageOf(metadata: unknown, checkInIso: string): number | null {
  if (!metadata || typeof metadata !== "object") return null;
  const m = metadata as { stage?: unknown; checkInTime?: unknown };
  // Birakma saati degistiyse (modifyBooking) eski saatin asamalari sayilmaz.
  if (m.checkInTime !== checkInIso) return null;
  return typeof m.stage === "number" ? m.stage : null;
}

/**
 * Kapanis kosulu. Tarama sorgusunda VE `cancelBooking`in kilidinde ayni nesne:
 * arada check-in (`checkedInAt`) ya da "Misafiri bekle" (`lateHoldUntil > now`)
 * geldiyse kilit eslesmez, iptal olmaz.
 */
export function lateCloseGuard(now: Date): Prisma.BookingWhereInput {
  return {
    checkedInAt: null,
    checkInTime: { lte: new Date(now.getTime() - LATE_CLOSE_AFTER_MIN * MINUTE_MS) },
    OR: [{ lateHoldUntil: null }, { lateHoldUntil: { lte: now } }],
  };
}

const SHOP_SELECT = {
  name: true,
  timezone: true,
  owner: { select: { phone: true } },
} as const;

/**
 * Gec birakma taramasi (`late-dropoff-scan`, 5 dk'da bir). Kural `src/lib/late-dropoff.ts`.
 *
 * Tekrar korumasi `OverdueGuestReminderService` ile ayni: asama GONDERIMDEN ONCE
 * rezervasyon basina `pg_advisory_xact_lock` altinda `BookingEvent` olarak
 * sahiplenilir. Kapanis `cancelBooking`in kosullu kilidine `guard` ekler: tarama
 * ile kilit arasinda check-in ya da "Misafiri bekle" gelirse iptal gerceklesmez.
 */
export class LateDropoffService {
  async run(opts: { now?: Date; limit?: number; batchSize?: number; maxBatches?: number } = {}): Promise<LateDropoffReport> {
    const now = opts.now ?? new Date();
    const startedAt = Date.now();
    const overBudget = () => Date.now() - startedAt > LATE_DROPOFF_TIME_BUDGET_MS;
    const report: LateDropoffReport = {
      remindersScanned: 0,
      remindersSent: 0,
      remindersUndelivered: 0,
      partnerAlerts: 0,
      noChannel: 0,
      lostRace: 0,
      closeScanned: 0,
      closed: 0,
      closedSilently: 0,
      closeSkipped: 0,
      deferred: 0,
      limitReached: false,
    };

    // Kapanis once: deadline'i gecmis kayit hatirlatma degil kapanis bekler.
    await this.closeDue(now, report, overBudget, opts.batchSize ?? 100, opts.maxBatches ?? 20);
    await this.sendReminders(now, report, overBudget, opts.limit ?? 200);

    logger.info({ ...report }, "late_dropoff_scan_summary");
    return report;
  }

  private async sendReminders(
    now: Date,
    report: LateDropoffReport,
    overBudget: () => boolean,
    limit: number,
  ): Promise<void> {
    const bookings = await prisma.booking.findMany({
      where: {
        status: { in: [...LATE_ACTIONABLE_STATUSES] },
        checkedInAt: null,
        checkInTime: {
          gt: new Date(now.getTime() - LATE_CLOSE_AFTER_MIN * MINUTE_MS),
          lte: new Date(now.getTime() - lateReminderOffsetMs(1)),
        },
        OR: [{ lateHoldUntil: null }, { lateHoldUntil: { lte: now } }],
      },
      select: {
        id: true,
        status: true,
        checkInTime: true,
        checkOutTime: true,
        checkedInAt: true,
        lateHoldUntil: true,
        guestId: true,
        guestEmail: true,
        locale: true,
        guest: { select: { email: true } },
        shop: { select: SHOP_SELECT },
      },
      orderBy: { checkInTime: "asc" },
      take: limit,
    });
    report.remindersScanned = bookings.length;
    if (bookings.length === limit) {
      report.limitReached = true;
      logger.warn({ limit }, "late_dropoff_reminder_limit_reached");
    }
    if (bookings.length === 0) return;

    const events = await prisma.bookingEvent.findMany({
      where: { bookingId: { in: bookings.map((b) => b.id) }, event: LATE_DROPOFF_REMINDER_EVENT },
      select: { bookingId: true, metadata: true },
    });
    const checkInIso = new Map(bookings.map((b) => [b.id, b.checkInTime.toISOString()]));
    const sent = new Map<string, number[]>();
    for (const e of events) {
      const s = stageOf(e.metadata, checkInIso.get(e.bookingId) ?? "");
      if (s != null) sent.set(e.bookingId, [...(sent.get(e.bookingId) ?? []), s]);
    }

    await runWithConcurrency(bookings, LATE_DROPOFF_CONCURRENCY, async (b) => {
      const stage = nextLateReminderStage(b, now, sent.get(b.id) ?? []);
      if (stage == null) return;
      if (overBudget()) {
        report.deferred++;
        return;
      }
      const email = bookingNotificationEmail(b);
      const guestReachable = email != null || b.guestId != null;
      const partner = stage === LATE_PARTNER_STAGE;
      if (!guestReachable && !partner) {
        report.noChannel++;
        return;
      }
      const iso = b.checkInTime.toISOString();
      if (!(await this.claimStage(b.id, stage, iso, now, { guest: guestReachable, partner }))) {
        report.lostRace++;
        return;
      }
      const closeAt = lateCloseAt(b) ?? new Date(b.checkInTime.getTime() + LATE_CLOSE_AFTER_MIN * MINUTE_MS);

      if (guestReachable) {
        try {
          const r = await notificationService.sendLateDropoffNotice({
            bookingId: b.id,
            kind: "reminder",
            email,
            hasAccount: b.guestId != null,
            locale: b.locale ?? DEFAULT_NOTIFICATION_LOCALE,
            at: closeAt,
            checkOutAt: b.checkOutTime,
            shop: { name: b.shop.name, phone: b.shop.owner.phone, timeZone: bookingTimeZone(b.shop) },
            now,
          });
          if (r.push || r.email) report.remindersSent++;
          else report.remindersUndelivered++;
        } catch (err) {
          // Sahiplenildi: tekrar denenmez (iki kez gitmesindense bir kez eksik gitsin).
          report.remindersUndelivered++;
          logger.warn({ err, bookingId: b.id, stage }, "late_dropoff_reminder_failed");
        }
      } else {
        report.noChannel++;
      }

      if (partner) {
        const ok = await notificationService
          .notifyPartnerLateDropoff({ bookingId: b.id, closeAt })
          .catch((err) => {
            logger.warn({ err, bookingId: b.id }, "late_dropoff_partner_alert_failed");
            return false;
          });
        if (ok) report.partnerAlerts++;
      }
    });
  }

  /**
   * Asamayi kilit altinda sahiplenir; kilit icinde durum, bekletme ve yazilmis
   * asamalar YENIDEN okunur (arada check-in, bekletme ya da baska calisma).
   */
  private async claimStage(
    bookingId: string,
    stage: number,
    checkInIso: string,
    now: Date,
    audience: { guest: boolean; partner: boolean },
  ): Promise<boolean> {
    return prisma.$transaction(async (tx) => {
      const lockKey = `late-dropoff:${bookingId}`;
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${lockKey})::bigint)`;
      const b = await tx.booking.findUnique({
        where: { id: bookingId },
        select: { status: true, checkedInAt: true, checkInTime: true, lateHoldUntil: true },
      });
      if (!b || !isLateActionableStatus(b.status) || b.checkedInAt != null) return false;
      if (b.checkInTime.toISOString() !== checkInIso || isLateHoldActive(b, now)) return false;
      const existing = await tx.bookingEvent.findMany({
        where: { bookingId, event: LATE_DROPOFF_REMINDER_EVENT },
        select: { metadata: true },
      });
      if (existing.some((e) => (stageOf(e.metadata, checkInIso) ?? 0) >= stage)) return false;
      await tx.bookingEvent.create({
        data: { bookingId, event: LATE_DROPOFF_REMINDER_EVENT, metadata: { stage, checkInTime: checkInIso, ...audience } },
      });
      return true;
    });
  }

  /** Bu birakma saati icin misafire hatirlatma sahiplenilmis rezervasyonlar. */
  private async warnedGuests(rows: ReadonlyArray<{ id: string; checkInTime: Date }>): Promise<Set<string>> {
    if (rows.length === 0) return new Set();
    const events = await prisma.bookingEvent.findMany({
      where: { bookingId: { in: rows.map((r) => r.id) }, event: LATE_DROPOFF_REMINDER_EVENT },
      select: { bookingId: true, metadata: true },
    });
    const iso = new Map(rows.map((r) => [r.id, r.checkInTime.toISOString()]));
    const out = new Set<string>();
    for (const e of events) {
      const guest = (e.metadata as { guest?: unknown } | null)?.guest === true;
      if (guest && stageOf(e.metadata, iso.get(e.bookingId) ?? "") != null) out.add(e.bookingId);
    }
    return out;
  }

  private async closeDue(
    now: Date,
    report: LateDropoffReport,
    overBudget: () => boolean,
    batchSize: number,
    maxBatches: number,
  ): Promise<void> {
    const closeCutoff = new Date(now.getTime() - LATE_CLOSE_AFTER_MIN * MINUTE_MS);
    const guard = lateCloseGuard(now);
    const attempted: string[] = [];

    for (let batch = 0; batch < maxBatches; batch++) {
      if (overBudget()) break;
      const rows = await prisma.booking.findMany({
        where: {
          status: { in: [...NOT_DROPPED_STATUSES] },
          ...guard,
          ...(attempted.length > 0 ? { id: { notIn: [...attempted] } } : {}),
        },
        select: {
          id: true,
          status: true,
          checkInTime: true,
          checkOutTime: true,
          checkedInAt: true,
          lateHoldUntil: true,
          guestId: true,
          guestEmail: true,
          locale: true,
          guest: { select: { email: true } },
          shop: { select: SHOP_SELECT },
        },
        orderBy: { checkInTime: "asc" },
        take: batchSize,
      });
      attempted.push(...rows.map((r) => r.id));
      report.closeScanned += rows.length;
      const warned = await this.warnedGuests(rows);

      await runWithConcurrency(rows, LATE_DROPOFF_CONCURRENCY, async (b) => {
        if (overBudget()) {
          report.deferred++;
          return;
        }
        const closeAt = lateCloseAt(b) ?? closeCutoff;
        const actionable = isLateActionableStatus(b.status);
        /*
          "Kapandi" yalnizca uyarilmis misafire (hatirlatma aldi ya da esnaf bekletti):
          ilk yayinda / kesinti sonrasi hic hatirlatma gormemis misafire kapanis haberi
          gitmez. Cok eski kapanis da (kesinti uzun surduyse) sessiz kalir.
        */
        const silent =
          !actionable || isSilentBacklog(closeAt, now) || (!warned.has(b.id) && b.lateHoldUntil == null);
        const r = await cancelBooking(b.id, {
          silent: true,
          // Odemesiz niyet hic teslim edilemezdi: "gelinmedi" degil "suresi doldu".
          reason: actionable ? "no_show" : "expired_no_dropoff",
          guard,
          eventMetadata: { auto: true, ...(silent ? { notified: false } : {}) },
        });
        if (!r.ok) {
          report.closeSkipped++;
          logger.info({ bookingId: b.id, code: r.code }, "late_dropoff_close_skipped");
          return;
        }
        report.closed++;
        if (silent) {
          report.closedSilently++;
          return;
        }
        const email = bookingNotificationEmail(b);
        if (email == null && b.guestId == null) return;
        await notificationService
          .sendLateDropoffNotice({
            bookingId: b.id,
            kind: "closed",
            email,
            hasAccount: b.guestId != null,
            locale: b.locale ?? DEFAULT_NOTIFICATION_LOCALE,
            at: closeAt,
            checkOutAt: b.checkOutTime,
            shop: { name: b.shop.name, phone: b.shop.owner.phone, timeZone: bookingTimeZone(b.shop) },
            now,
          })
          .catch((err) => logger.warn({ err, bookingId: b.id }, "late_dropoff_closed_notice_failed"));
      });
      if (rows.length < batchSize) break;
    }
  }
}

export const lateDropoffService = new LateDropoffService();
