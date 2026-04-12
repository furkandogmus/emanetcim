import logger from "../lib/logger";
import prisma from "../lib/db";
import {
  isNetgsmConfigured,
  normalizeTrGsm10,
  parseAdminGsmNumbers,
  sendNetgsmRestSms,
} from "@/lib/netgsm";

export interface INotificationService {
  sendEmail(
    to: string,
    subject: string,
    body: string,
    bookingId?: string,
    html?: string,
  ): Promise<boolean>;
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
  async sendEmail(
    to: string,
    subject: string,
    body: string,
    bookingId?: string,
    html?: string,
  ): Promise<boolean> {
    try {
      const resendKey = process.env.RESEND_API_KEY;
      let status: "SENT" | "FAILED" | "SKIPPED" = "SKIPPED";
      let errorDetail: string | null = null;

      if (resendKey && to.includes("@")) {
        const from =
          process.env.EMAIL_FROM?.trim() ||
          process.env.RESEND_FROM?.trim() ||
          "BagajPark <info@bagajpark.com>";
        const r = await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${resendKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            from,
            to: [to],
            subject,
            text: body,
            ...(html ? { html } : {}),
          }),
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
      } else if (to.includes("@")) {
        if (process.env.NODE_ENV === "production") {
          logger.warn(
            { to, subject, bookingId },
            "notification_email_missing_resend_in_production",
          );
        } else {
          logger.info(
            { to, subject, bookingId },
            "notification_email_skipped_no_resend",
          );
        }
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
    const publicKey = process.env.VAPID_PUBLIC_KEY?.trim();
    const privateKey = process.env.VAPID_PRIVATE_KEY?.trim();
    const contact =
      process.env.VAPID_CONTACT_EMAIL?.trim() || "mailto:support@bagajpark.com";

    try {
      const subs = await prisma.pushSubscription.findMany({
        where: { userId },
      });

      if (publicKey && privateKey && subs.length > 0) {
        const webpush = (await import("web-push")).default;
        webpush.setVapidDetails(contact, publicKey, privateKey);
        const payload = JSON.stringify({ title, body: message, bookingId });
        let anyOk = false;
        for (const s of subs) {
          try {
            await webpush.sendNotification(
              {
                endpoint: s.endpoint,
                keys: { p256dh: s.p256dh, auth: s.auth },
              },
              payload,
            );
            anyOk = true;
          } catch (err: unknown) {
            const status = (err as { statusCode?: number })?.statusCode;
            if (status === 404 || status === 410) {
              await prisma.pushSubscription.deleteMany({
                where: { id: s.id },
              });
            }
            logger.warn({ err, userId, subId: s.id }, "push_send_failed");
          }
        }
        await prisma.notificationLog.create({
          data: {
            bookingId,
            type: "PUSH",
            recipient: userId,
            subject: title,
            content: message,
            status: anyOk ? "SENT" : "FAILED",
            error: anyOk ? null : "all_subscriptions_failed",
          },
        });
        return anyOk;
      }

      const skipReason =
        !publicKey || !privateKey
          ? "vapid_not_configured"
          : subs.length === 0
            ? "no_subscriptions"
            : "unknown";
      logger.info(
        { userId, title, skipReason },
        "notification_push_skipped",
      );

      await prisma.notificationLog.create({
        data: {
          bookingId,
          type: "PUSH",
          recipient: userId,
          subject: title,
          content: message,
          status: "SKIPPED",
          error: skipReason,
        },
      });

      return false;
    } catch (error) {
      logger.error({ error }, "[Notification] Push Failed");
      return false;
    }
  }

  /**
   * Misafir: `GUEST_SMS_BOOKING_NOTIFICATIONS=true` iken yeni talep SMS’i (Netgsm).
   */
  async notifyGuestBookingRequestSms(
    phoneE164OrTr10: string,
    bookingId: string,
    shopName: string,
  ): Promise<void> {
    if (process.env.GUEST_SMS_BOOKING_NOTIFICATIONS !== "true") return;
    const shortId = bookingId.replace(/-/g, "").slice(0, 8);
    const msg = `BagajPark: Talebiniz alindi — ${shopName}. Ref: ${shortId}`;
    await this.sendSms(phoneE164OrTr10, msg, bookingId);
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
    const content =
      {
        tr: { subject: "Valiziniz Güvende! 🔒", body: "Valiziniz teslim alındı." },
        en: { subject: "Your Luggage is Safe! 🔒", body: "Your luggage has been received." },
      }[locale] || { tr: { subject: "Valiziniz Güvende! 🔒", body: "Valiziniz teslim alındı." } }.tr;

    const sealLangTr = locale === "tr";
    const escapeHtml = (s: string) =>
      s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

    let seals: { sealNumber: number; bagIndex: number; bagSize: string }[] = [];
    try {
      seals = await prisma.bookingSeal.findMany({
        where: { bookingId },
        orderBy: { bagIndex: "asc" },
        select: { sealNumber: true, bagIndex: true, bagSize: true },
      });
    } catch (err) {
      logger.error({ err, bookingId }, "notifyCheckIn_seals_load_failed");
    }

    let textBody = content.body;
    let htmlBody: string | undefined;
    if (seals.length > 0) {
      if (sealLangTr) {
        const lines = seals
          .map((s) => `• Valiz ${s.bagIndex} (${s.bagSize}): mühür #${s.sealNumber}`)
          .join("\n");
        textBody += `\n\nAtanan mühür seri numaraları:\n${lines}\n\nCheck-in sırasında kaydedildi. Teslim alırken valizlerinizle karşılaştırın.`;
        const items = seals
          .map(
            (s) =>
              `<li>Valiz ${s.bagIndex} (${escapeHtml(s.bagSize)}): <strong>#${s.sealNumber}</strong></li>`,
          )
          .join("");
        htmlBody = `<p>${escapeHtml(content.body)}</p><p><strong>Atanan mühür seri numaraları:</strong></p><ul>${items}</ul><p style="font-size:13px;color:#555">Check-in sırasında kaydedildi. Teslim alırken valizlerinizle karşılaştırın.</p>`;
      } else {
        const lines = seals
          .map((s) => `• Bag ${s.bagIndex} (${s.bagSize}): seal #${s.sealNumber}`)
          .join("\n");
        textBody += `\n\nSeal serial numbers assigned:\n${lines}\n\nRecorded at check-in. Use these to match your bags at pick-up.`;
        const items = seals
          .map(
            (s) =>
              `<li>Bag ${s.bagIndex} (${escapeHtml(s.bagSize)}): <strong>#${s.sealNumber}</strong></li>`,
          )
          .join("");
        htmlBody = `<p>${escapeHtml(content.body)}</p><p><strong>Seal serial numbers assigned:</strong></p><ul>${items}</ul><p style="font-size:13px;color:#555">Recorded at check-in. Use these to match your bags at pick-up.</p>`;
      }
    }

    if (email.includes("@")) {
      await this.sendEmail(email, content.subject, textBody, bookingId, htmlBody);
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
