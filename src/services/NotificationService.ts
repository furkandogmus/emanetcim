import logger from "../lib/logger";
import prisma from "../lib/db";
import { formatTryCurrency } from "@/lib/currency";
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
    const domain = process.env.NEXT_PUBLIC_APP_URL || "https://bagajpark.com";
    const bookingUrl = `${domain}/${locale}/bookings/${bookingId}`;
    const shortId = bookingId.replace(/-/g, "").slice(0, 8);
    /**
     * Tutar LOCALE'E GÖRE biçimlendiriliyor.
     *
     * Eskiden `Number(totalPrice).toFixed(2)` idi ve e-postada `₺1520.00`
     * yazıyordu. Türkçe'de doğrusu `₺1.520,00`: nokta orada BİNLİK ayracıdır,
     * yani tutar yanlış okunabilir. Rezervasyon onayı misafirin sakladığı belge —
     * üzerindeki rakamın okunuşunda belirsizlik olmamalı.
     */
    const priceTr = formatTryCurrency(Number(totalPrice), "tr-TR");
    const priceEn = formatTryCurrency(Number(totalPrice), "en-US");

    const content = {
      tr: {
        subject: "BagajPark: Rezervasyonunuz Oluşturuldu! 🎒",
        body: `Merhaba,\n\nRezervasyonunuz başarıyla oluşturuldu!\n\nReferans: ${shortId}\nToplam Tutar: ${priceTr}\n\nÜcreti dükkana gittiğinizde ödeyebilirsiniz.\n\nBiletinizi görmek için: ${bookingUrl}`,
        html: `<div style="font-family:sans-serif;max-width:600px;margin:0 auto;padding:20px">
          <h2 style="color:#ea580c">Rezervasyonunuz Oluşturuldu! 🎒</h2>
          <p>Rezervasyonunuz başarıyla oluşturuldu. Ücreti dükkana gittiğinizde ödeyebilirsiniz.</p>
          <table style="width:100%;border-collapse:collapse;margin:16px 0">
            <tr><td style="padding:8px;color:#6b7280">Referans</td><td style="padding:8px;font-weight:bold">${shortId}</td></tr>
            <tr style="background:#f9fafb"><td style="padding:8px;color:#6b7280">Toplam Tutar</td><td style="padding:8px;font-weight:bold">${priceTr}</td></tr>
          </table>
          <a href="${bookingUrl}" style="display:inline-block;background:#ea580c;color:white;padding:12px 24px;text-decoration:none;border-radius:8px;font-weight:bold;margin:16px 0">Biletimi Görüntüle</a>
          <p style="font-size:13px;color:#6b7280;margin-top:24px">BagajPark — Güvenli Bagaj Emaneti</p>
        </div>`,
      },
      en: {
        subject: "BagajPark: Booking Confirmed! 🎒",
        body: `Hello,\n\nYour booking has been created!\n\nReference: ${shortId}\nTotal: ${priceEn}\n\nYou can pay at the shop when you arrive.\n\nView your ticket: ${bookingUrl}`,
        html: `<div style="font-family:sans-serif;max-width:600px;margin:0 auto;padding:20px">
          <h2 style="color:#ea580c">Booking Confirmed! 🎒</h2>
          <p>Your booking has been created. You can pay at the shop when you arrive.</p>
          <table style="width:100%;border-collapse:collapse;margin:16px 0">
            <tr><td style="padding:8px;color:#6b7280">Reference</td><td style="padding:8px;font-weight:bold">${shortId}</td></tr>
            <tr style="background:#f9fafb"><td style="padding:8px;color:#6b7280">Total</td><td style="padding:8px;font-weight:bold">${priceEn}</td></tr>
          </table>
          <a href="${bookingUrl}" style="display:inline-block;background:#ea580c;color:white;padding:12px 24px;text-decoration:none;border-radius:8px;font-weight:bold;margin:16px 0">View My Ticket</a>
          <p style="font-size:13px;color:#6b7280;margin-top:24px">BagajPark — Secure Luggage Storage</p>
        </div>`,
      },
    }[locale] ?? {
      subject: "BagajPark: Rezervasyonunuz Oluşturuldu! 🎒",
      body: `Referans: ${shortId} — ${priceTr}. Bilet: ${bookingUrl}`,
      html: undefined as string | undefined,
    };

    if (emailOrPlaceholder.includes("@")) {
      await this.sendEmail(emailOrPlaceholder, content.subject, content.body, bookingId, content.html);
    }
  }

  /** Partner rezervasyonu onayladığında misafire onay e-postası gönderir. */
  async notifyBookingApproved(email: string, bookingId: string, shopName: string, locale: string = "tr"): Promise<void> {
    if (!email.includes("@")) return;
    const domain = process.env.NEXT_PUBLIC_APP_URL || "https://bagajpark.com";
    const bookingUrl = `${domain}/${locale}/bookings/${bookingId}`;
    const shortId = bookingId.replace(/-/g, "").slice(0, 8);

    const content = {
      tr: {
        subject: "BagajPark: Talebiniz Onaylandı 🎒",
        body: `Merhaba,\n\n${shopName} mağazası rezervasyon talebinizi onayladı!\n\nRezervasyon detayları: ${bookingUrl}\n\nReferans: ${shortId}`,
        html: `<div style="font-family:sans-serif;max-width:600px;margin:0 auto;padding:20px">
          <h2 style="color:#ea580c">Talebiniz Onaylandı! 🎒</h2>
          <p><strong>${shopName}</strong> rezervasyon talebinizi onayladı.</p>
          <a href="${bookingUrl}" style="display:inline-block;background:#ea580c;color:white;padding:12px 24px;text-decoration:none;border-radius:8px;font-weight:bold;margin:16px 0">Rezervasyonu Görüntüle</a>
          <p style="font-size:13px;color:#6b7280">Referans: ${shortId}</p>
        </div>`,
      },
      en: {
        subject: "BagajPark: Request Approved 🎒",
        body: `Hello,\n\n${shopName} has approved your booking request!\n\nBooking details: ${bookingUrl}\n\nReference: ${shortId}`,
        html: `<div style="font-family:sans-serif;max-width:600px;margin:0 auto;padding:20px">
          <h2 style="color:#ea580c">Request Approved! 🎒</h2>
          <p><strong>${shopName}</strong> has approved your booking request.</p>
          <a href="${bookingUrl}" style="display:inline-block;background:#ea580c;color:white;padding:12px 24px;text-decoration:none;border-radius:8px;font-weight:bold;margin:16px 0">View Booking</a>
          <p style="font-size:13px;color:#6b7280">Reference: ${shortId}</p>
        </div>`,
      },
    }[locale] ?? { subject: "BagajPark: Onaylandı", body: `Rezervasyon: ${bookingUrl}`, html: undefined as string | undefined };

    await this.sendEmail(email, content.subject, content.body, bookingId, content.html);
  }

  /**
   * Rezervasyon iptal/reddedildiğinde misafire e-posta.
   */
  async notifyBookingCancelled(email: string, bookingId: string, shopName: string, locale: string = "tr"): Promise<void> {
    if (!email.includes("@")) return;
    const shortId = bookingId.replace(/-/g, "").slice(0, 8);

    const content = {
      tr: {
        subject: "BagajPark: Rezervasyon Talebi Reddedildi",
        body: `Merhaba,\n\n${shopName} mağazasına yaptığınız rezervasyon talebi (Ref: ${shortId}) ne yazık ki reddedildi.\n\nBagajpark.com üzerinden başka mağazalara göz atabilirsiniz.`,
        html: `<div style="font-family:sans-serif;max-width:600px;margin:0 auto;padding:20px">
          <h2 style="color:#6b7280">Rezervasyon Talebi Reddedildi</h2>
          <p><strong>${shopName}</strong> mağazasına yaptığınız talep maalesef reddedildi.</p>
          <p>Diğer mağazaları keşfetmek için <a href="${process.env.NEXT_PUBLIC_APP_URL || "https://bagajpark.com"}/${locale}/search" style="color:#ea580c">buraya tıklayın</a>.</p>
          <p style="font-size:13px;color:#6b7280">Referans: ${shortId}</p>
        </div>`,
      },
      en: {
        subject: "BagajPark: Booking Request Declined",
        body: `Hello,\n\nYour booking request to ${shopName} (Ref: ${shortId}) was unfortunately declined.\n\nYou can browse other locations on bagajpark.com.`,
        html: `<div style="font-family:sans-serif;max-width:600px;margin:0 auto;padding:20px">
          <h2 style="color:#6b7280">Booking Request Declined</h2>
          <p>Your request to <strong>${shopName}</strong> was unfortunately declined.</p>
          <p>Browse other locations <a href="${process.env.NEXT_PUBLIC_APP_URL || "https://bagajpark.com"}/${locale}/search" style="color:#ea580c">here</a>.</p>
          <p style="font-size:13px;color:#6b7280">Reference: ${shortId}</p>
        </div>`,
      },
    }[locale] ?? { subject: "BagajPark: İptal", body: `Ref: ${shortId}`, html: undefined as string | undefined };

    await this.sendEmail(email, content.subject, content.body, bookingId, content.html);
  }

  /**
   * Yeni bir rezervasyon alındığında esnafa ve adminlere bildirim gönderir.
   * SMS (Netgsm) devre dışı olsa bile, e-posta ile bildirim göndererek çalışmayı sürdürür.
   */
  async notifyPartnerAndAdminsForNewPaidBooking(params: {
    bookingId: string;
    shopName: string;
    partnerPhone: string | null | undefined;
    totalPrice: number;
  }): Promise<void> {
    const { bookingId, shopName, partnerPhone, totalPrice } = params;
    const shortId = bookingId.replace(/-/g, "").slice(0, 8);

    // Veritabanından rezervasyon durumunu ve partner e-posta adresini çekelim
    let partnerEmail: string | null = null;
    let isRequest = true;
    try {
      const b = await prisma.booking.findUnique({
        where: { id: bookingId },
        include: { shop: { include: { owner: true } } },
      });
      if (b) {
        partnerEmail = b.shop?.owner?.email ?? null;
        isRequest = b.status === "WAITING_APPROVAL";
      }
    } catch (err) {
      logger.error({ err, bookingId }, "notifyPartnerAndAdmins_db_failed");
    }

    // 1. E-posta Bildirimi
    const domain = process.env.NEXT_PUBLIC_APP_URL || "https://bagajpark.com";
    const panelUrl = `${domain}/tr/partner`;
    /**
     * Tutar LOCALE'E GÖRE biçimlendiriliyor.
     *
     * Eskiden `Number(totalPrice).toFixed(2)` idi ve e-postada `₺1520.00`
     * yazıyordu. Türkçe'de doğrusu `₺1.520,00`: nokta orada BİNLİK ayracıdır,
     * yani tutar yanlış okunabilir. Rezervasyon onayı misafirin sakladığı belge —
     * üzerindeki rakamın okunuşunda belirsizlik olmamalı.
     */
    const priceTr = formatTryCurrency(Number(totalPrice), "tr-TR");
    const priceEn = formatTryCurrency(Number(totalPrice), "en-US");

    let emailSubject = "";
    let emailBody = "";
    let emailHtml = "";

    if (isRequest) {
      // Yeni Rezervasyon Talebi (WAITING_APPROVAL)
      emailSubject = `BagajPark: Yeni Rezervasyon Talebi! 🎒 (Kod: ${shortId})`;
      emailBody = `Merhaba,\n\n${shopName} mağazanıza yeni bir rezervasyon talebi geldi!\n\nTutar: ${priceTr}\nReferans Kodu: ${shortId}\n\nTalebi onaylamak veya reddetmek için partner panelinize giriş yapın:\n${panelUrl}`;
      emailHtml = `<div style="font-family:sans-serif;max-width:600px;margin:0 auto;padding:20px">
        <h2 style="color:#ea580c">Yeni Rezervasyon Talebi! 🎒</h2>
        <p><strong>${shopName}</strong> mağazanıza yeni bir rezervasyon talebi ulaştı. Onaylama veya reddetme işlemlerini gerçekleştirmek için lütfen partner panelinize giriş yapın.</p>
        <table style="width:100%;border-collapse:collapse;margin:16px 0">
          <tr><td style="padding:8px;color:#6b7280">Referans Kodu</td><td style="padding:8px;font-weight:bold">${shortId}</td></tr>
          <tr style="background:#f9fafb"><td style="padding:8px;color:#6b7280">Toplam Tutar</td><td style="padding:8px;font-weight:bold">${priceTr}</td></tr>
        </table>
        <a href="${panelUrl}" style="display:inline-block;background:#ea580c;color:white;padding:12px 24px;text-decoration:none;border-radius:8px;font-weight:bold;margin:16px 0">Partner Paneline Git</a>
        <p style="font-size:13px;color:#6b7280;margin-top:24px">BagajPark — Esnaf Ortaklık Programı</p>
      </div>`;
    } else {
      emailSubject = `BagajPark: Yeni Onaylı Rezervasyon! (Kod: ${shortId})`;
      emailBody = `Merhaba,\n\n${shopName} mağazanıza yeni bir onaylı rezervasyon geldi!\n\nTutar: ${priceTr}\nReferans Kodu: ${shortId}\n\nDetayları görmek için partner panelinize giriş yapın:\n${panelUrl}`;
      emailHtml = `<div style="font-family:sans-serif;max-width:600px;margin:0 auto;padding:20px">
        <h2 style="color:#16a34a">Yeni Onaylı Rezervasyon!</h2>
        <p><strong>${shopName}</strong> mağazanıza yeni bir onaylı rezervasyon geldi. Müşteri bagajı teslim etmek üzere dükkanınıza gelecektir.</p>
        <table style="width:100%;border-collapse:collapse;margin:16px 0">
          <tr><td style="padding:8px;color:#6b7280">Referans Kodu</td><td style="padding:8px;font-weight:bold">${shortId}</td></tr>
          <tr style="background:#f9fafb"><td style="padding:8px;color:#6b7280">Toplam Tutar</td><td style="padding:8px;font-weight:bold">${priceTr}</td></tr>
        </table>
        <a href="${panelUrl}" style="display:inline-block;background:#16a34a;color:white;padding:12px 24px;text-decoration:none;border-radius:8px;font-weight:bold;margin:16px 0">Partner Paneline Git</a>
        <p style="font-size:13px;color:#6b7280;margin-top:24px">BagajPark — Esnaf Ortaklık Programı</p>
      </div>`;
    }

    // Esnafa e-posta gönder
    if (partnerEmail && partnerEmail.includes("@")) {
      void this.sendEmail(partnerEmail, emailSubject, emailBody, bookingId, emailHtml).catch((e) => {
        logger.error({ err: e, partnerEmail, bookingId }, "notifyPartnerAndAdmins_partner_email_failed");
      });
    }

    // Adminlere e-posta gönder
    const adminEmails = (process.env.ADMIN_EMAILS ?? "")
      .split(",")
      .map((e) => e.trim().toLowerCase())
      .filter(Boolean);
    
    for (const adminEmail of adminEmails) {
      if (adminEmail.includes("@")) {
        const adminSubject = `[Admin] ${emailSubject}`;
        void this.sendEmail(adminEmail, adminSubject, emailBody, bookingId, emailHtml).catch((e) => {
          logger.error({ err: e, adminEmail, bookingId }, "notifyPartnerAndAdmins_admin_email_failed");
        });
      }
    }

    // 2. SMS Bildirimi (Yalnızca Netgsm yapılandırılmışsa)
    if (!isNetgsmConfigured()) {
      logger.debug({ bookingId }, "netgsm_off_skipping_booking_sms");
      return;
    }

    const partnerMsg = isRequest
      ? `BagajPark: Yeni rezervasyon talebi — ${shopName}. Kod: ${shortId} Tutar: ${priceTr}`
      : `BagajPark: Rezervasyon odemesi tamamlandi — ${shopName}. Kod: ${shortId} Tutar: ${priceTr}`;

    const p = normalizeTrGsm10(partnerPhone ?? undefined);
    if (p) {
      await this.sendSms(p, partnerMsg, bookingId);
    } else {
      logger.debug({ bookingId }, "partner_sms_skipped_no_phone");
    }

    const adminMsg = `BagajPark [Admin]: ${isRequest ? "Yeni talep" : "Yeni odeme"} — ${shopName}. ${shortId} ${priceTr}`;
    for (const adminNo of parseAdminGsmNumbers()) {
      await this.sendSms(adminNo, adminMsg, bookingId);
    }
  }

  /**
   * Şikayet açıldığında admin GSM listesine SMS ve tüm admin e-postalarına e-posta gönderir.
   */
  async notifyAdminsForDispute(params: {
    bookingId: string;
    reason: string;
  }): Promise<void> {
    const { bookingId, reason } = params;
    const shortId = bookingId.replace(/-/g, "").slice(0, 8);

    // 1. E-posta Bildirimi
    const adminEmails = (process.env.ADMIN_EMAILS ?? "")
      .split(",")
      .map((e) => e.trim().toLowerCase())
      .filter(Boolean);

    const emailSubject = `[Admin] BagajPark: Yeni Şikayet Bildirimi! ⚠️ (Rez: ${shortId})`;
    const emailBody = `Merhaba,\n\nRezervasyon hakkında yeni bir şikayet açıldı.\n\nReferans Kodu: ${shortId}\nŞikayet Nedeni: ${reason}`;
    const emailHtml = `<div style="font-family:sans-serif;max-width:600px;margin:0 auto;padding:20px">
      <h2 style="color:#dc2626">Yeni Şikayet Bildirimi! ⚠️</h2>
      <p>Bir rezervasyon için şikayet/itiraz oluşturulmuştur.</p>
      <table style="width:100%;border-collapse:collapse;margin:16px 0">
        <tr><td style="padding:8px;color:#6b7280">Referans Kodu</td><td style="padding:8px;font-weight:bold">${shortId}</td></tr>
        <tr style="background:#f9fafb"><td style="padding:8px;color:#6b7280">Şikayet Nedeni</td><td style="padding:8px;font-weight:bold;color:#dc2626">${reason}</td></tr>
      </table>
      <p style="font-size:13px;color:#6b7280;margin-top:24px">BagajPark — Yönetim Masası</p>
    </div>`;

    for (const adminEmail of adminEmails) {
      if (adminEmail.includes("@")) {
        void this.sendEmail(adminEmail, emailSubject, emailBody, bookingId, emailHtml).catch((e) => {
          logger.error({ err: e, adminEmail, bookingId }, "notifyAdminsForDispute_email_failed");
        });
      }
    }

    // 2. SMS Bildirimi (Yalnızca Netgsm yapılandırılmışsa)
    if (!isNetgsmConfigured()) {
      logger.debug({ bookingId: params.bookingId }, "netgsm_off_skipping_dispute_sms");
      return;
    }
    const admins = parseAdminGsmNumbers();
    if (admins.length === 0) return;

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
