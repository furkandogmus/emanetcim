import logger from "../lib/logger";
import prisma from "../lib/db";

export interface INotificationService {
  sendEmail(to: string, subject: string, body: string, bookingId?: string): Promise<boolean>;
  sendSms(to: string, message: string, bookingId?: string): Promise<boolean>;
  sendPush(userId: string, title: string, message: string, bookingId?: string): Promise<boolean>;
}

/**
 * NotificationService - Merkezi Bildirim Yönetimi
 */
export class NotificationService implements INotificationService {
  /**
   * E-posta gönderimi
   */
  async sendEmail(to: string, subject: string, body: string, bookingId?: string): Promise<boolean> {
    try {
      const resendKey = process.env.RESEND_API_KEY;
      if (resendKey && to.includes("@")) {
        const from = process.env.RESEND_FROM || "Emanetçi <onboarding@resend.dev>";
        const r = await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${resendKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ from, to: [to], subject, text: body }),
        });
        if (!r.ok) {
          const err = await r.text();
          logger.error({ err, status: r.status }, "[Notification] Resend API error");
          await prisma.notificationLog.create({
            data: { bookingId, type: "EMAIL", recipient: to, subject, content: body, status: "FAILED" },
          });
          return false;
        }
        logger.info({ to, subject }, "[Notification] Email sent via Resend");
      } else {
        logger.info({ to, subject }, "[Notification] Email (log only — set RESEND_API_KEY for delivery)");
      }

      await prisma.notificationLog.create({
        data: {
          bookingId,
          type: "EMAIL",
          recipient: to,
          subject,
          content: body,
          status: "SENT",
        },
      });

      return true;
    } catch (error) {
      logger.error({ error }, "[Notification] Email Failed");
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
          status: "SENT"
        }
      });

      return true;
    } catch (error) {
      logger.error({ error }, "[Notification] Push Failed");
      return false;
    }
  }

  /**
   * SMS gönderimi
   */
  async sendSms(to: string, message: string, bookingId?: string): Promise<boolean> {
    try {
      logger.info({ to, message }, "[Notification] SMS Sent Simulation");
      
      await prisma.notificationLog.create({
        data: {
          bookingId,
          type: "SMS",
          recipient: to,
          content: message,
          status: "SENT"
        }
      });

      return true;
    } catch (error) {
      logger.error({ error }, "[Notification] SMS Failed");
      return false;
    }
  }

  /**
   * Rezervasyon Onay Bildirimi
   */
  async notifyBookingSuccess(emailOrPlaceholder: string, bookingId: string, totalPrice: number): Promise<void> {
    const subject = "Emanetçi: Rezervasyonunuz Onaylandı! 🎒";
    const body = `Merhaba, ${bookingId} numaralı rezervasyonunuz başarıyla tamamlandı. \n\nToplam Tutar: ₺${totalPrice}\nBiletiniz: /bookings/${bookingId}`;

    if (emailOrPlaceholder.includes("@")) {
      await this.sendEmail(emailOrPlaceholder, subject, body, bookingId);
    }
    const phoneLike = /^\+?[0-9\s-]{10,}$/.test(emailOrPlaceholder);
    if (phoneLike) {
      await this.sendSms(emailOrPlaceholder, `Emanetçi: Rezervasyonunuz (${bookingId.substring(0, 6)}) onaylandı.`, bookingId);
    }
  }

  async notifyCheckIn(email: string, bookingId: string): Promise<void> {
    if (email.includes("@")) {
      await this.sendEmail(email, "Valiziniz Güvende! 🔒", "Valiziniz teslim alındı.", bookingId);
    }
  }

  async notifyCheckOut(email: string, bookingId: string): Promise<void> {
    if (email.includes("@")) {
      await this.sendEmail(email, "İyi Yolculuklar! 👋", "Valiziniz size teslim edildi.", bookingId);
    }
  }
}

export const notificationService = new NotificationService();
