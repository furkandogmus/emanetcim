import logger from "../lib/logger";
import prisma from "../lib/db";
import {
  isNetgsmConfigured,
  normalizeTrGsm10,
  parseAdminGsmNumbers,
  sendNetgsmRestSms,
} from "@/lib/netgsm";

export interface INotificationService {
  sendEmail(to: string, subject: string, body: string, bookingId?: string): Promise<boolean>;
  sendSms(to: string, message: string, bookingId?: string): Promise<boolean>;
  sendPush(userId: string, title: string, message: string, bookingId?: string): Promise<boolean>;
}

/**
 * NotificationService - Merkezi Bildirim Yönetimi
 * SMS: Netgsm (@netgsm/sms) — yalnızca esnaf / admin numaralarına (misafir SMS yok).
 */
export class NotificationService implements INotificationService {
  /**
   * E-posta gönderimi
   */
  async sendEmail(to: string, subject: string, body: string, bookingId?: string): Promise<boolean> {
    try {
      const resendKey = process.env.RESEND_API_KEY;
      let status: "SENT" | "FAILED" | "SKIPPED" = "SKIPPED";
      let errorDetail: string | null = null;

      if (resendKey && to.includes("@")) {
        const from = process.env.RESEND_FROM || "BagajPark <info@bagajpark.com>";
        const r = await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${resendKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ from, to: [to], subject, text: body }),
        });
        if (!r.ok) {
          errorDetail = await r.text();
          status = "FAILED";
          logger.error(
            { status: r.status, err: errorDetail, to, subject, bookingId },
            "notification_resend_error",
          );
        } else {
          status = "SENT";
          logger.info({ to, subject, bookingId }, "notification_email_sent");
        }
      } else {
        logger.info(
          { to, subject, bookingId },
          "notification_email_skipped_no_resend",
        );
      }

      await prisma.notificationLog.create({
        data: {
          bookingId,
          type: "EMAIL",
          recipient: to,
          subject,
          content: body,
          status,
          error: errorDetail,
        },
      });

      return status !== "FAILED";
    } catch (error) {
      logger.error({ err: error, to, bookingId }, "notification_email_exception");
      try {
        await prisma.notificationLog.create({
          data: {
            bookingId,
            type: "EMAIL",
            recipient: to,
            subject,
            content: body,
            status: "FAILED",
            error: error instanceof Error ? error.message : String(error),
          },
        });
      } catch {
        /* ignore */
      }
      return false;
    }
  }

  /**
   * Push bildirim gönderimi
   */
  async sendPush(userId: string, title: string, message: string, bookingId?: string): Promise<boolean> {
    try {
      logger.info({ userId, title }, "[Notification] Push Sent Simulation");

      await prisma.notificationLog.create({
        data: {
          bookingId,
          type: "PUSH",
          recipient: userId,
          subject: title,
          content: message,
          status: "SENT",
        },
      });

      return true;
    } catch (error) {
      logger.error({ error }, "[Notification] Push Failed");
      return false;
    }
  }

  /**
   * Netgsm ile SMS (REST). NETGSM_* tanımlı değilse SKIPPED.
   * `to` — normalize edilmiş 10 hane (5xxxxxxxxx) veya ham GSM; içeride normalize edilir.
   */
  async sendSms(to: string, message: string, bookingId?: string): Promise<boolean> {
    const no = normalizeTrGsm10(to);
    if (!no) {
      logger.warn({ to, bookingId }, "notification_sms_invalid_number");
      await prisma.notificationLog.create({
        data: {
          bookingId,
          type: "SMS",
          recipient: to,
          content: message,
          status: "FAILED",
          error: "invalid_gsm",
        },
      });
      return false;
    }

    if (!isNetgsmConfigured()) {
      logger.debug({ to: no, bookingId }, "notification_sms_skipped_netgsm_not_configured");
      return false;
    }

    try {
      const result = await sendNetgsmRestSms({ to10: no, message });
      const ok = result.ok;
      await prisma.notificationLog.create({
        data: {
          bookingId,
          type: "SMS",
          recipient: no,
          content: message,
          status: ok ? "SENT" : "FAILED",
          error: ok ? (result.jobId ?? null) : (result.error ?? "netgsm_failed"),
        },
      });
      if (ok) {
        logger.info({ to: no, bookingId, jobId: result.jobId }, "notification_sms_sent");
      } else {
        logger.error({ to: no, bookingId, err: result.error }, "notification_sms_failed");
      }
      return ok;
    } catch (error) {
      const errMsg = error instanceof Error ? error.message : String(error);
      logger.error({ err: error, to: no, bookingId }, "notification_sms_exception");
      await prisma.notificationLog.create({
        data: {
          bookingId,
          type: "SMS",
          recipient: no,
          content: message,
          status: "FAILED",
          error: errMsg,
        },
      });
      return false;
    }
  }

  /**
   * Misafir: yalnızca e-posta (SMS gönderilmez).
   */
  async notifyBookingSuccess(emailOrPlaceholder: string, bookingId: string, totalPrice: number, locale: string = "tr"): Promise<void> {
    const content = {
      tr: {
        subject: "BagajPark: Rezervasyonunuz Onaylandı! 🎒",
        body: `Merhaba, ${bookingId} numaralı rezervasyonunuz başarıyla tamamlandı. \n\nToplam Tutar: ₺${totalPrice}\nBiletiniz: /bookings/${bookingId}`
      },
      en: {
        subject: "BagajPark: Booking Confirmed! 🎒",
        body: `Hello, your booking ${bookingId} has been successfully completed. \n\nTotal Price: ₺${totalPrice}\nYour Ticket: /bookings/${bookingId}`
      }
    }[locale] || {
      tr: {
        subject: "BagajPark: Rezervasyonunuz Onaylandı! 🎒",
        body: `Merhaba, ${bookingId} numaralı rezervasyonunuz başarıyla tamamlandı. \n\nToplam Tutar: ₺${totalPrice}\nBiletiniz: /bookings/${bookingId}`
      }
    }.tr;

    if (emailOrPlaceholder.includes("@")) {
      await this.sendEmail(emailOrPlaceholder, content.subject, content.body, bookingId);
    }
  }

  /**
   * Ödeme sonrası: esnafa (dükkan sahibi telefonu) + isteğe bağlı admin numaralarına SMS.
   */
  async notifyPartnerAndAdminsForNewPaidBooking(params: {
    bookingId: string;
    shopName: string;
    partnerPhone: string | null | undefined;
    totalPrice: number;
  }): Promise<void> {
    if (!isNetgsmConfigured()) {
      logger.debug({ bookingId: params.bookingId }, "netgsm_off_skipping_booking_sms");
      return;
    }

    const { bookingId, shopName, partnerPhone, totalPrice } = params;
    const shortId = bookingId.replace(/-/g, "").slice(0, 8);
    const partnerMsg = `BagajPark: Yeni rezervasyon — ${shopName}. Kod: ${shortId} Tutar: ${Number(totalPrice).toFixed(2)} TL`;

    const p = normalizeTrGsm10(partnerPhone ?? undefined);
    if (p) {
      await this.sendSms(p, partnerMsg, bookingId);
    } else {
      logger.debug({ bookingId }, "partner_sms_skipped_no_phone");
    }

    const adminMsg = `BagajPark [Admin]: Yeni ödeme — ${shopName}. ${shortId} ${Number(totalPrice).toFixed(2)} TL`;
    for (const adminNo of parseAdminGsmNumbers()) {
      await this.sendSms(adminNo, adminMsg, bookingId);
    }
  }

  /**
   * Şikayet açıldığında yalnızca admin GSM listesine SMS.
   */
  async notifyAdminsForDispute(params: {
    bookingId: string;
    reason: string;
  }): Promise<void> {
    if (!isNetgsmConfigured()) {
      logger.debug({ bookingId: params.bookingId }, "netgsm_off_skipping_dispute_sms");
      return;
    }
    const admins = parseAdminGsmNumbers();
    if (admins.length === 0) return;

    const { bookingId, reason } = params;
    const shortId = bookingId.replace(/-/g, "").slice(0, 8);
    const msg = `BagajPark [Admin]: Yeni şikayet (${reason}) — rez. ${shortId}`;
    for (const adminNo of admins) {
      await this.sendSms(adminNo, msg, bookingId);
    }
  }

  async notifyCheckIn(email: string, bookingId: string, locale: string = "tr"): Promise<void> {
    const content = {
      tr: { subject: "Valiziniz Güvende! 🔒", body: "Valiziniz teslim alındı." },
      en: { subject: "Your Luggage is Safe! 🔒", body: "Your luggage has been received." }
    }[locale] || { tr: { subject: "Valiziniz Güvende! 🔒", body: "Valiziniz teslim alındı." } }.tr;

    if (email.includes("@")) {
      await this.sendEmail(email, content.subject, content.body, bookingId);
    }
  }

  async notifyCheckOut(email: string, bookingId: string, locale: string = "tr"): Promise<void> {
    const content = {
      tr: { subject: "İyi Yolculuklar! 👋", body: "Valiziniz size teslim edildi." },
      en: { subject: "Safe Travels! 👋", body: "Your luggage has been delivered to you." }
    }[locale] || { tr: { subject: "İyi Yolculuklar! 👋", body: "Valiziniz size teslim edildi." } }.tr;

    if (email.includes("@")) {
      await this.sendEmail(email, content.subject, content.body, bookingId);
    }
  }
}

export const notificationService = new NotificationService();
