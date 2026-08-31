import logger from "../lib/logger";
import prisma from "../lib/db";
import { formatTryCurrency } from "@/lib/currency";
import { fetchWithTimeout } from "@/lib/async-timeout";
import { renderEmailHtml, escapeEmailHtml, EMAIL_BRAND_COLOR } from "@/lib/email-template";
import { bcp47ForUiLocale } from "@/lib/intl-locale";
import {
  isNetgsmConfigured,
  normalizeTrGsm10,
  parseAdminGsmNumbers,
  sendNetgsmRestSms,
} from "@/lib/netgsm";
import { bookingShortCode } from "@/lib/booking-code";
import { getSiteBaseUrl } from "@/lib/site-base-url";

/**
 * NEDEN (2026-08-25): `sendEmail` partner check-in/check-out akışlarında
 * (`actions/partner.ts`) DOĞRUDAN `await`leniyor — yani esnafın "Teslim Al" /
 * "Teslim Et" butonuna bastığı istek bu gönderim bitene kadar sonuçlanmaz.
 * Resend'e yapılan ham `fetch` çağrısında hiç zaman aşımı yoktu: yavaşlarsa
 * ya da yanıt vermezse çağıran akış SÜRESİZ askıda kalırdı.
 */
const EMAIL_SEND_TIMEOUT_MS = 8000;

/**
 * Dil haritasindan secer; bilinmeyen dil TURKCE sablona duser.
 *
 * NEDEN AYRI FONKSIYON (2026-08-25): her sablon kendi `?? { ... }` yedegini
 * yaziyordu ve o yedekler DEGRADE'ydi — tek satirlik, HTML'siz, Turkce bir
 * e-posta. Yani bir dil unutuldugunda misafir yalnizca yanlis dili degil, bozuk
 * bir belgeyi de aliyordu. Artik yedek TAM Turkce sablondur.
 *
 * `notification-locale-coverage` mandali zaten hicbir dilin eksik kalmamasini
 * garanti ediyor; bu fonksiyon o mandal delinse bile cikan seyin okunabilir
 * olmasini saglar.
 */
function pickLocale<T>(byLocale: Record<string, T>, locale: string): T {
  return byLocale[locale] ?? byLocale.tr;
}

/**
 * UI dili -> para birimi bicimlendirme locale'i.
 *
 * Eskiden alti tutarin ALTISI da her gonderimde hesaplaniyor, besi atiliyordu.
 */
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
        const r = await fetchWithTimeout(
          "https://api.resend.com/emails",
          {
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
          },
          EMAIL_SEND_TIMEOUT_MS,
          "notification_email_send",
        );
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
    const shortId = bookingShortCode(bookingId);
    const msg = `BagajPark: Talebiniz alindi — ${shopName}. Kod: ${shortId}`;
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
  /**
   * Rezervasyon olusturuldu bildirimi (misafir).
   *
   * Tutar LOCALE'E GORE bicimlendirilir. Eskiden `Number(totalPrice).toFixed(2)`
   * idi ve e-postada `₺1520.00` yaziyordu; Turkce'de dogrusu `₺1.520,00` — nokta
   * orada BINLIK ayracidir, yani tutar yanlis okunabilir. Rezervasyon onayi
   * misafirin sakladigi belgedir, rakamin okunusunda belirsizlik olmamali.
   */
  async notifyBookingSuccess(emailOrPlaceholder: string, bookingId: string, totalPrice: number, locale: string = "tr"): Promise<void> {
    /*
      KOK ADRES ORTAK YARDIMCIDAN (2026-08-31). Burasi yedek olarak URETIM alan
      adini SABITLIYORDU (`https://bagajpark.com`): degisken tanimsiz kalan bir
      hazirlik/deneme ortami, test kullanicilarina sessizce uretim baglantilari
      gonderiyordu. Ayrica `NEXT_PUBLIC_BASE_URL`i yok sayiyordu.
    */
    const domain = getSiteBaseUrl();
    const bookingUrl = `${domain}/${locale}/bookings/${bookingId}`;
    const shortId = bookingShortCode(bookingId);
    /* Eskiden ALTI dilin tutari da her gonderimde hesaplaniyordu; besi bosa. */
    const price = formatTryCurrency(Number(totalPrice), bcp47ForUiLocale(locale));

    const content = pickLocale({
      tr: {
        subject: `BagajPark: Rezervasyonunuz Oluşturuldu! 🎒`,
        body: `Merhaba,\n\nRezervasyonunuz başarıyla oluşturuldu!\n\nRezervasyon Kodu: ${shortId}\nToplam Tutar: ${price}\n\nÜcreti dükkana gittiğinizde ödeyebilirsiniz.\n\nBiletinizi görmek için: ${bookingUrl}`,
        heading: `Rezervasyonunuz Oluşturuldu! 🎒`,
        p1: `Rezervasyonunuz başarıyla oluşturuldu. Ücreti dükkana gittiğinizde ödeyebilirsiniz.`,
        row1: `Rezervasyon Kodu`,
        row2: `Toplam Tutar`,
        cta: `Biletimi Görüntüle`,
        footer: `BagajPark — Güvenli Bagaj Emaneti`,
      },
      en: {
        subject: `BagajPark: Booking Confirmed! 🎒`,
        body: `Hello,\n\nYour booking has been created!\n\nBooking code: ${shortId}\nTotal: ${price}\n\nYou can pay at the shop when you arrive.\n\nView your ticket: ${bookingUrl}`,
        heading: `Booking Confirmed! 🎒`,
        p1: `Your booking has been created. You can pay at the shop when you arrive.`,
        row1: `Booking code`,
        row2: `Total`,
        cta: `View My Ticket`,
        footer: `BagajPark — Secure Luggage Storage`,
      },
      de: {
        subject: `BagajPark: Ihre Reservierung wurde erstellt! 🎒`,
        body: `Hallo,\n\nIhre Reservierung wurde erfolgreich erstellt!\n\nBuchungscode: ${shortId}\nGesamtbetrag: ${price}\n\nSie können vor Ort im Geschäft bezahlen.\n\nUm Ihr Ticket anzuzeigen: ${bookingUrl}`,
        heading: `Ihre Reservierung wurde erstellt! 🎒`,
        p1: `Ihre Reservierung wurde erfolgreich erstellt. Sie können vor Ort im Geschäft bezahlen.`,
        row1: `Buchungscode`,
        row2: `Gesamtbetrag`,
        cta: `Mein Ticket ansehen`,
        footer: `BagajPark — Sichere Gepäckaufbewahrung`,
      },
      fr: {
        subject: `BagajPark : Réservation confirmée ! 🎒`,
        body: `Bonjour,\n\nVotre réservation a été créée avec succès !\n\nCode de réservation : ${shortId}\nMontant total : ${price}\n\nVous pouvez payer à la boutique à votre arrivée.\n\nPour voir votre billet : ${bookingUrl}`,
        heading: `Réservation confirmée ! 🎒`,
        p1: `Votre réservation a été créée avec succès. Vous pouvez payer à la boutique à votre arrivée.`,
        row1: `Code de réservation`,
        row2: `Montant total`,
        cta: `Voir mon billet`,
        footer: `BagajPark — Consigne à bagages sécurisée`,
      },
      ja: {
        subject: `BagajPark: ご予約が完了しました！🎒`,
        body: `こんにちは、\n\nご予約が完了しました！\n\n予約コード: ${shortId}\n合計金額: ${price}\n\n店舗到着時にお支払いいただけます。\n\nチケットを見る: ${bookingUrl}`,
        heading: `ご予約が完了しました！🎒`,
        p1: `ご予約が完了しました。店舗到着時にお支払いいただけます。`,
        row1: `予約コード`,
        row2: `合計金額`,
        cta: `チケットを見る`,
        footer: `BagajPark — 安全な荷物預かりサービス`,
      },
      fa: {
        subject: `BagajPark: رزرو شما ثبت شد! 🎒`,
        body: `سلام،\n\nرزرو شما با موفقیت ثبت شد!\n\nکد رزرو: ${shortId}\nمبلغ کل: ${price}\n\nمی‌توانید هنگام مراجعه به فروشگاه پرداخت کنید.\n\nمشاهده بلیط: ${bookingUrl}`,
        heading: `رزرو شما ثبت شد! 🎒`,
        p1: `رزرو شما با موفقیت ثبت شد. می‌توانید هنگام مراجعه به فروشگاه پرداخت کنید.`,
        row1: `کد رزرو`,
        row2: `مبلغ کل`,
        cta: `مشاهده بلیط من`,
        footer: `BagajPark — نگهداری امن چمدان`,
      },
    }, locale);

    const html = renderEmailHtml({
      locale,
      heading: content.heading,
      paragraphs: [content.p1],
      rows: [
        { label: content.row1, value: shortId },
        { label: content.row2, value: price },
      ],
      cta: { href: bookingUrl, label: content.cta, variant: "button" },
      footer: content.footer,
    });

    if (emailOrPlaceholder.includes("@")) {
      await this.sendEmail(emailOrPlaceholder, content.subject, content.body, bookingId, html);
    }
  }

  /** Partner rezervasyonu onayladığında misafire onay e-postası gönderir. */
  /**
   * "Açılınca haber ver" kaydı alındığında gönderilen TEYİT.
   *
   * NEDEN VAR (2026-08-31'de ölçüldü): kayıt sonrası yalnızca ekranda bir toast
   * çıkıyordu. İki sonucu vardı ve ikisi de sessizdi:
   *
   *   - Adres DOĞRULANMIYORDU. Yazım hatası olan bir e-posta sessizce kabul
   *     ediliyor, kişi açılış gününde hiçbir şey almıyordu. Yani "açıldığı gün
   *     ilk sen haberdar ol" sözü, kişinin hiç öğrenemeyeceği bir şekilde
   *     bozuluyordu.
   *   - Kişinin elinde KAYIT KALMIYORDU. Toast kayboluyor; geri döndüğünde
   *     kaydolup kaydolmadığını bilmiyor ve baştan yazıyor.
   *
   * Teyit ikisini birden çözüyor: gelen kutusunda bir iz kalıyor ve adres
   * çalışmıyorsa bu HEMEN belli oluyor.
   */
  async notifyPrelaunchInterestReceived(
    email: string,
    shopId: string,
    shopName: string,
    locale: string = "tr",
  ): Promise<void> {
    /*
      GOVDEYE GIREN DUKKAN ADI KACIRILIR (2026-08-31). `shopName` esnafin kendi
      yazdigi deger; kacirilmadan `<strong>${...}</strong>` icine girince esnaf,
      misafire giden e-postaya baglanti/isaretleme enjekte edebiliyordu.
      `subject` ve `body` DUZ METIN oldugu icin orada ham deger kullanilir --
      kacirmak kullaniciya `&amp;` gosterirdi.
    */
    const shopNameHtml = escapeEmailHtml(shopName);
    if (!email.includes("@")) return;
    const domain = getSiteBaseUrl();
    const shopUrl = `${domain}/${locale}/shop/${shopId}`;

    const content = pickLocale({
      tr: {
        subject: `${shopName} açılınca haber vereceğiz 🎒`,
        body: `Merhaba,\n\n${shopName} için "açılınca haber ver" kaydını aldık. Nokta hizmete girdiği gün ilk sana yazacağız.\n\nNokta: ${shopUrl}`,
        heading: `Kaydını aldık 🎒`,
        p1: `${shopNameHtml} için "açılınca haber ver" isteğini kaydettik.`,
        p2: `Bu nokta henüz rezervasyon almıyor. Hizmete girdiği gün ilk sana yazacağız — başka bir şey yapmana gerek yok.`,
        cta: `Noktayı gör`,
        footer: `BagajPark — Güvenli Bagaj Emaneti`,
      },
      en: {
        subject: `We'll tell you when ${shopName} opens 🎒`,
        body: `Hello,\n\nWe have your request to be notified when ${shopName} opens. You will hear from us the day it goes live.\n\nPoint: ${shopUrl}`,
        heading: `Request received 🎒`,
        p1: `We saved your request to be notified about ${shopNameHtml}.`,
        p2: `This point does not take bookings yet. You will be the first to hear the day it opens — nothing else to do.`,
        cta: `View the point`,
        footer: `BagajPark — Secure Luggage Storage`,
      },
      de: {
        subject: `Wir melden uns, wenn ${shopName} öffnet 🎒`,
        body: `Hallo,\n\nIhre Anfrage für eine Benachrichtigung zu ${shopName} ist bei uns. Am Eröffnungstag hören Sie von uns.\n\nStandort: ${shopUrl}`,
        heading: `Anfrage erhalten 🎒`,
        p1: `Wir haben Ihre Benachrichtigungsanfrage für ${shopNameHtml} gespeichert.`,
        p2: `Dieser Standort nimmt noch keine Buchungen an. Am Eröffnungstag erfahren Sie es als Erste — sonst ist nichts zu tun.`,
        cta: `Standort ansehen`,
        footer: `BagajPark — Sichere Gepäckaufbewahrung`,
      },
      fr: {
        subject: `Nous vous préviendrons à l'ouverture de ${shopName} 🎒`,
        body: `Bonjour,\n\nNous avons bien votre demande d'alerte pour ${shopName}. Vous serez prévenu le jour de l'ouverture.\n\nPoint : ${shopUrl}`,
        heading: `Demande enregistrée 🎒`,
        p1: `Nous avons enregistré votre demande d'alerte pour ${shopNameHtml}.`,
        p2: `Ce point n'accepte pas encore de réservations. Vous serez le premier informé le jour de l'ouverture — rien d'autre à faire.`,
        cta: `Voir le point`,
        footer: `BagajPark — Consigne à bagages sécurisée`,
      },
      ja: {
        subject: `${shopName} のオープン時にお知らせします 🎒`,
        body: `こんにちは。\n\n${shopName} のオープン通知のご登録を承りました。オープン当日に最初にお知らせします。\n\n拠点: ${shopUrl}`,
        heading: `ご登録を承りました 🎒`,
        p1: `${shopNameHtml} のオープン通知をご登録いただきました。`,
        p2: `この拠点はまだ予約を受け付けていません。オープン当日に最初にお知らせしますので、ほかに必要な操作はありません。`,
        cta: `拠点を見る`,
        footer: `BagajPark — 安全な手荷物預かり`,
      },
      fa: {
        subject: `هنگام افتتاح ${shopName} خبر می‌دهیم 🎒`,
        body: `سلام،\n\nدرخواست شما برای اطلاع از افتتاح ${shopName} ثبت شد. روز افتتاح اول از همه به شما خبر می‌دهیم.\n\nنقطه: ${shopUrl}`,
        heading: `درخواست شما ثبت شد 🎒`,
        p1: `درخواست اطلاع‌رسانی شما برای ${shopNameHtml} ذخیره شد.`,
        p2: `این نقطه هنوز رزرو نمی‌گیرد. روز افتتاح اول از همه باخبر می‌شوید — کار دیگری لازم نیست.`,
        cta: `دیدن نقطه`,
        footer: `BagajPark — نگهداری امن چمدان`,
      },
    }, locale);

    const html = renderEmailHtml({
      locale,
      heading: content.heading,
      paragraphs: [content.p1, content.p2],
      cta: { href: shopUrl, label: content.cta, variant: "button" },
      footer: content.footer,
    });

    await this.sendEmail(email, content.subject, content.body, undefined, html);
  }

  /**
   * Talep testi noktası HİZMETE AÇILDIĞINDA, "haber ver" diyen kişiye e-posta.
   *
   * NEDEN VAR (2026-08-31'de ölçüldü): `PrelaunchInterest` kayıtları yalnızca
   * YAZILIYOR ve SAYILIYOR'du — onlardan bir şey gönderen tek satır kod yoktu.
   * Oysa kişi e-postasını tam olarak şu söz karşılığında bırakıyor: "Açıldığı
   * gün ilk sen haberdar ol." Yani ürünün en değerli sinyali, karşılığı
   * olmayan bir vaat üzerine toplanıyordu.
   *
   * Gönderim IDEMPOTENT olmak zorunda; `PrelaunchInterest.notifiedAt` bunu
   * sağlıyor (bkz. `PrelaunchInterestService.notifyOpened`). Bir pazarlama
   * e-postasını iki kez göndermek, hiç göndermemekten daha çok zarar verir.
   */
  async notifyPrelaunchOpened(
    email: string,
    shopId: string,
    shopName: string,
    locale: string = "tr",
  ): Promise<void> {
    /*
      GOVDEYE GIREN DUKKAN ADI KACIRILIR (2026-08-31). `shopName` esnafin kendi
      yazdigi deger; kacirilmadan `<strong>${...}</strong>` icine girince esnaf,
      misafire giden e-postaya baglanti/isaretleme enjekte edebiliyordu.
      `subject` ve `body` DUZ METIN oldugu icin orada ham deger kullanilir --
      kacirmak kullaniciya `&amp;` gosterirdi.
    */
    const shopNameHtml = escapeEmailHtml(shopName);
    if (!email.includes("@")) return;
    const domain = getSiteBaseUrl();
    const shopUrl = `${domain}/${locale}/shop/${shopId}`;

    const content = pickLocale({
      tr: {
        subject: `${shopName} açıldı — valizini bırakabilirsin 🎒`,
        body: `Merhaba,\n\n${shopName} artık hizmette. Sözümüzü tutuyoruz: açıldığı gün haber veriyoruz.\n\nRezervasyon: ${shopUrl}`,
        heading: `${shopNameHtml} açıldı 🎒`,
        p1: `Bu noktada emanet hizmeti başladı. Bir süre önce "açılınca haber ver" demiştin — sözümüzü tutuyoruz.`,
        p2: `Artık valizini bırakmak için rezervasyon yapabilirsin.`,
        cta: `Rezervasyon yap`,
        footer: `BagajPark — Güvenli Bagaj Emaneti`,
      },
      en: {
        subject: `${shopName} is open — you can drop your bags 🎒`,
        body: `Hello,\n\n${shopName} is now live. You asked to be told the day it opens, so here we are.\n\nBook: ${shopUrl}`,
        heading: `${shopNameHtml} is open 🎒`,
        p1: `Luggage storage has started at this point. A while ago you asked us to tell you when it opens — here we are.`,
        p2: `You can book a drop-off now.`,
        cta: `Book now`,
        footer: `BagajPark — Secure Luggage Storage`,
      },
      de: {
        subject: `${shopName} ist offen — Sie können Ihr Gepäck abgeben 🎒`,
        body: `Hallo,\n\n${shopName} ist jetzt in Betrieb. Sie wollten es am Eröffnungstag erfahren — hier sind wir.\n\nBuchen: ${shopUrl}`,
        heading: `${shopNameHtml} ist offen 🎒`,
        p1: `An diesem Standort hat die Gepäckaufbewahrung begonnen. Sie hatten gebeten, bei der Eröffnung informiert zu werden — hier sind wir.`,
        p2: `Sie können jetzt eine Abgabe buchen.`,
        cta: `Jetzt buchen`,
        footer: `BagajPark — Sichere Gepäckaufbewahrung`,
      },
      fr: {
        subject: `${shopName} est ouvert — déposez vos bagages 🎒`,
        body: `Bonjour,\n\n${shopName} est maintenant en service. Vous vouliez être prévenu le jour de l'ouverture — nous y sommes.\n\nRéserver : ${shopUrl}`,
        heading: `${shopNameHtml} est ouvert 🎒`,
        p1: `La consigne à bagages a ouvert à ce point. Vous nous aviez demandé de vous prévenir le jour de l'ouverture — nous y sommes.`,
        p2: `Vous pouvez désormais réserver un dépôt.`,
        cta: `Réserver`,
        footer: `BagajPark — Consigne à bagages sécurisée`,
      },
      ja: {
        subject: `${shopName} がオープンしました — 荷物を預けられます 🎒`,
        body: `こんにちは。\n\n${shopName} の運用が始まりました。オープン当日にお知らせするお約束でした。\n\n予約: ${shopUrl}`,
        heading: `${shopNameHtml} がオープンしました 🎒`,
        p1: `この拠点で手荷物預かりが始まりました。オープンしたら知らせてほしいとご登録いただいていました。`,
        p2: `お預け入れのご予約が可能になりました。`,
        cta: `予約する`,
        footer: `BagajPark — 安全な手荷物預かり`,
      },
      fa: {
        subject: `${shopName} باز شد — می‌توانید چمدانتان را بسپارید 🎒`,
        body: `سلام،\n\n${shopName} اکنون فعال است. گفته بودید روز افتتاح خبر بدهیم — همان روز رسید.\n\nرزرو: ${shopUrl}`,
        heading: `${shopNameHtml} باز شد 🎒`,
        p1: `نگهداری چمدان در این نقطه آغاز شد. شما خواسته بودید روز افتتاح خبر بدهیم.`,
        p2: `اکنون می‌توانید برای سپردن چمدان رزرو کنید.`,
        cta: `رزرو کنید`,
        footer: `BagajPark — نگهداری امن چمدان`,
      },
    }, locale);

    const html = renderEmailHtml({
      locale,
      heading: content.heading,
      paragraphs: [content.p1, content.p2],
      cta: { href: shopUrl, label: content.cta, variant: "button" },
      footer: content.footer,
    });

    await this.sendEmail(email, content.subject, content.body, undefined, html);
  }

  /** Esnaf rezervasyonu onayladiginda misafire onay e-postasi gonderir. */
  async notifyBookingApproved(email: string, bookingId: string, shopName: string, locale: string = "tr"): Promise<void> {
    /*
      GOVDEYE GIREN DUKKAN ADI KACIRILIR (2026-08-31). `shopName` esnafin kendi
      yazdigi deger; kacirilmadan `<strong>${...}</strong>` icine girince esnaf,
      misafire giden e-postaya baglanti/isaretleme enjekte edebiliyordu.
      `subject` ve `body` DUZ METIN oldugu icin orada ham deger kullanilir --
      kacirmak kullaniciya `&amp;` gosterirdi.
    */
    const shopNameHtml = escapeEmailHtml(shopName);
    if (!email.includes("@")) return;
    const domain = getSiteBaseUrl();
    const bookingUrl = `${domain}/${locale}/bookings/${bookingId}`;
    const shortId = bookingShortCode(bookingId);

    const content = pickLocale({
      tr: {
        subject: `BagajPark: Talebiniz Onaylandı 🎒`,
        body: `Merhaba,\n\n${shopName} mağazası rezervasyon talebinizi onayladı!\n\nRezervasyon detayları: ${bookingUrl}\n\nRezervasyon Kodu: ${shortId}`,
        heading: `Talebiniz Onaylandı! 🎒`,
        p1: `<strong>${shopNameHtml}</strong> rezervasyon talebinizi onayladı.`,
        cta: `Rezervasyonu Görüntüle`,
        footer: `Rezervasyon Kodu: ${shortId}`,
      },
      en: {
        subject: `BagajPark: Request Approved 🎒`,
        body: `Hello,\n\n${shopName} has approved your booking request!\n\nBooking details: ${bookingUrl}\n\nBooking code: ${shortId}`,
        heading: `Request Approved! 🎒`,
        p1: `<strong>${shopNameHtml}</strong> has approved your booking request.`,
        cta: `View Booking`,
        footer: `Booking code: ${shortId}`,
      },
      de: {
        subject: `BagajPark: Ihre Anfrage wurde angenommen 🎒`,
        body: `Hallo,\n\n${shopName} hat Ihre Reservierungsanfrage angenommen!\n\nReservierungsdetails: ${bookingUrl}\n\nBuchungscode: ${shortId}`,
        heading: `Ihre Anfrage wurde angenommen! 🎒`,
        p1: `<strong>${shopNameHtml}</strong> hat Ihre Reservierungsanfrage angenommen.`,
        cta: `Reservierung ansehen`,
        footer: `Buchungscode: ${shortId}`,
      },
      fr: {
        subject: `BagajPark : Votre demande a été acceptée 🎒`,
        body: `Bonjour,\n\n${shopName} a accepté votre demande de réservation !\n\nDétails de la réservation : ${bookingUrl}\n\nCode de réservation : ${shortId}`,
        heading: `Votre demande a été acceptée ! 🎒`,
        p1: `<strong>${shopNameHtml}</strong> a accepté votre demande de réservation.`,
        cta: `Voir la réservation`,
        footer: `Code de réservation : ${shortId}`,
      },
      ja: {
        subject: `BagajPark: リクエストが承認されました 🎒`,
        body: `こんにちは、\n\n${shopName} があなたの予約リクエストを承認しました！\n\n予約の詳細: ${bookingUrl}\n\n予約コード: ${shortId}`,
        heading: `リクエストが承認されました！🎒`,
        p1: `<strong>${shopNameHtml}</strong> があなたの予約リクエストを承認しました。`,
        cta: `予約を見る`,
        footer: `予約コード: ${shortId}`,
      },
      fa: {
        subject: `BagajPark: درخواست شما تأیید شد 🎒`,
        body: `سلام،\n\nفروشگاه ${shopName} درخواست رزرو شما را تأیید کرد!\n\nجزئیات رزرو: ${bookingUrl}\n\nکد رزرو: ${shortId}`,
        heading: `درخواست شما تأیید شد! 🎒`,
        p1: `<strong>${shopNameHtml}</strong> درخواست رزرو شما را تأیید کرد.`,
        cta: `مشاهده رزرو`,
        footer: `کد رزرو: ${shortId}`,
      },
    }, locale);

    const html = renderEmailHtml({
      locale,
      heading: content.heading,
      paragraphs: [content.p1],
      cta: { href: bookingUrl, label: content.cta, variant: "button" },
      footer: content.footer,
    });

    await this.sendEmail(email, content.subject, content.body, bookingId, html);
  }

  /** Talep reddedildiginde / rezervasyon iptal edildiginde misafire bildirim. */
  async notifyBookingCancelled(email: string, bookingId: string, shopName: string, locale: string = "tr"): Promise<void> {
    /*
      GOVDEYE GIREN DUKKAN ADI KACIRILIR (2026-08-31). `shopName` esnafin kendi
      yazdigi deger; kacirilmadan `<strong>${...}</strong>` icine girince esnaf,
      misafire giden e-postaya baglanti/isaretleme enjekte edebiliyordu.
      `subject` ve `body` DUZ METIN oldugu icin orada ham deger kullanilir --
      kacirmak kullaniciya `&amp;` gosterirdi.
    */
    const shopNameHtml = escapeEmailHtml(shopName);
    if (!email.includes("@")) return;
    const domain = getSiteBaseUrl();
    const searchUrl = `${domain}/${locale}/search`;
    const shortId = bookingShortCode(bookingId);

    const content = pickLocale({
      tr: {
        subject: `BagajPark: Rezervasyon Talebi Reddedildi`,
        body: `Merhaba,\n\n${shopName} mağazasına yaptığınız rezervasyon talebi (Kod: ${shortId}) ne yazık ki reddedildi.\n\nBagajpark.com üzerinden başka mağazalara göz atabilirsiniz.`,
        heading: `Rezervasyon Talebi Reddedildi`,
        p1: `<strong>${shopNameHtml}</strong> mağazasına yaptığınız talep maalesef reddedildi.`,
        p2: `Diğer mağazaları keşfetmek için {link}.`,
        p2Link: `buraya tıklayın`,
        footer: `Rezervasyon Kodu: ${shortId}`,
      },
      en: {
        subject: `BagajPark: Booking Request Declined`,
        body: `Hello,\n\nYour booking request to ${shopName} (Booking code: ${shortId}) was unfortunately declined.\n\nYou can browse other locations on bagajpark.com.`,
        heading: `Booking Request Declined`,
        p1: `Your request to <strong>${shopNameHtml}</strong> was unfortunately declined.`,
        p2: `Browse other locations {link}.`,
        p2Link: `here`,
        footer: `Booking code: ${shortId}`,
      },
      de: {
        subject: `BagajPark: Reservierungsanfrage abgelehnt`,
        body: `Hallo,\n\nIhre Reservierungsanfrage bei ${shopName} (Buchungscode: ${shortId}) wurde leider abgelehnt.\n\nSie können auf bagajpark.com andere Standorte durchsuchen.`,
        heading: `Reservierungsanfrage abgelehnt`,
        p1: `Ihre Anfrage bei <strong>${shopNameHtml}</strong> wurde leider abgelehnt.`,
        p2: `Entdecken Sie andere Standorte {link}.`,
        p2Link: `hier`,
        footer: `Buchungscode: ${shortId}`,
      },
      fr: {
        subject: `BagajPark : Demande de réservation refusée`,
        body: `Bonjour,\n\nVotre demande de réservation auprès de ${shopName} (Code de réservation : ${shortId}) a malheureusement été refusée.\n\nVous pouvez parcourir d'autres établissements sur bagajpark.com.`,
        heading: `Demande de réservation refusée`,
        p1: `Votre demande auprès de <strong>${shopNameHtml}</strong> a malheureusement été refusée.`,
        p2: `Découvrez d'autres établissements {link}.`,
        p2Link: `ici`,
        footer: `Code de réservation : ${shortId}`,
      },
      ja: {
        subject: `BagajPark: 予約リクエストが却下されました`,
        body: `こんにちは、\n\n${shopName} への予約リクエスト（予約コード: ${shortId}）は残念ながら却下されました。\n\nbagajpark.com で他の店舗をご覧いただけます。`,
        heading: `予約リクエストが却下されました`,
        p1: `<strong>${shopNameHtml}</strong> へのリクエストは残念ながら却下されました。`,
        p2: `他の店舗を{link}からご覧いただけます。`,
        p2Link: `こちら`,
        footer: `予約コード: ${shortId}`,
      },
      fa: {
        subject: `BagajPark: درخواست رزرو رد شد`,
        body: `سلام،\n\nمتأسفانه درخواست رزرو شما برای ${shopName} (کد رزرو: ${shortId}) رد شد.\n\nمی‌توانید سایر فروشگاه‌ها را در bagajpark.com مشاهده کنید.`,
        heading: `درخواست رزرو رد شد`,
        p1: `متأسفانه درخواست شما برای <strong>${shopNameHtml}</strong> رد شد.`,
        p2: `سایر فروشگاه‌ها را {link} مشاهده کنید.`,
        p2Link: `اینجا`,
        footer: `کد رزرو: ${shortId}`,
      },
    }, locale);

    const html = renderEmailHtml({
      locale,
      /* Notr baslik: bu olumsuz bir bildirim, marka turuncusu yanlis ton verir. */
      tone: "muted",
      heading: content.heading,
      paragraphs: [
        content.p1,
        /*
          Baglanti CUMLENIN ICINDE ve konumu dile gore degisiyor; bu yuzden
          ceviri `{link}` yer tutucusu tasir. Renk koddan gelir — eskiden
          `#ea580c` alti cevirinin ICINE gomuluydu ve marka rengi degisse
          e-postalarda eski renk kalirdi.
        */
        content.p2.replace(
          "{link}",
          `<a href="${searchUrl}" style="color:${EMAIL_BRAND_COLOR}">${content.p2Link}</a>`,
        ),
      ],
      footer: content.footer,
    });

    await this.sendEmail(email, content.subject, content.body, bookingId, html);
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
    const shortId = bookingShortCode(bookingId);

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
    const domain = getSiteBaseUrl();
    const panelUrl = `${domain}/tr/partner`;
    /**
     * Tutar LOCALE'E GÖRE biçimlendiriliyor.
     *
     * Eskiden `Number(totalPrice).toFixed(2)` idi ve e-postada `₺1520.00`
     * yazıyordu. Türkçe'de doğrusu `₺1.520,00`: nokta orada BİNLİK ayracıdır,
     * yani tutar yanlış okunabilir. Rezervasyon onayı misafirin sakladığı belge —
     * üzerindeki rakamın okunuşunda belirsizlik olmamalı.
     */
    // Bu bildirim yalnızca Türkiye'deki esnafa/admine gider (panelUrl `/tr/partner`
    // olarak sabit) — İngilizce sürüm hiç gerekmiyor, bu yüzden yalnızca priceTr var.
    const priceTr = formatTryCurrency(Number(totalPrice), "tr-TR");

    let emailSubject = "";
    let emailBody = "";
    let emailHtml = "";

    if (isRequest) {
      // Yeni Rezervasyon Talebi (WAITING_APPROVAL)
      emailSubject = `BagajPark: Yeni Rezervasyon Talebi! 🎒 (Kod: ${shortId})`;
      emailBody = `Merhaba,\n\n${shopName} mağazanıza yeni bir rezervasyon talebi geldi!\n\nTutar: ${priceTr}\nRezervasyon Kodu: ${shortId}\n\nTalebi onaylamak veya reddetmek için partner panelinize giriş yapın:\n${panelUrl}`;
      emailHtml = renderEmailHtml({
        locale: "tr",
        heading: "Yeni Rezervasyon Talebi! 🎒",
        paragraphs: [
          `<strong>${shopName}</strong> mağazanıza yeni bir rezervasyon talebi ulaştı. Onaylama veya reddetme işlemlerini gerçekleştirmek için lütfen partner panelinize giriş yapın.`,
        ],
        rows: [
          { label: "Rezervasyon Kodu", value: shortId },
          { label: "Toplam Tutar", value: priceTr },
        ],
        cta: { href: panelUrl, label: "Partner Paneline Git", variant: "button" },
        footer: "BagajPark — Esnaf Ortaklık Programı",
      });
    } else {
      emailSubject = `BagajPark: Yeni Onaylı Rezervasyon! (Kod: ${shortId})`;
      emailBody = `Merhaba,\n\n${shopName} mağazanıza yeni bir onaylı rezervasyon geldi!\n\nTutar: ${priceTr}\nRezervasyon Kodu: ${shortId}\n\nDetayları görmek için partner panelinize giriş yapın:\n${panelUrl}`;
      /* Onaylanmis is: ton `success` — baslik ve dugme birlikte yesile doner. */
      emailHtml = renderEmailHtml({
        locale: "tr",
        tone: "success",
        heading: "Yeni Onaylı Rezervasyon!",
        paragraphs: [
          `<strong>${shopName}</strong> mağazanıza yeni bir onaylı rezervasyon geldi. Müşteri bagajı teslim etmek üzere dükkanınıza gelecektir.`,
        ],
        rows: [
          { label: "Rezervasyon Kodu", value: shortId },
          { label: "Toplam Tutar", value: priceTr },
        ],
        cta: { href: panelUrl, label: "Partner Paneline Git", variant: "button" },
        footer: "BagajPark — Esnaf Ortaklık Programı",
      });
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

    /**
     * "Ödeme tamamlandı" DENMİYOR: tahsilat dükkanda yapılıyor (bkz. docs/PAYMENTS.md,
     * `ManualPaymentProvider`), booking oluşurken hiçbir ödeme alınmıyor — `markAsPaid`
     * yalnızca check-in akışında çağrılır. Eskiden burada "Rezervasyon odemesi
     * tamamlandi" yazıyordu; bu, aynı e-postanın kendi metniyle bile çelişen ve
     * P0-0'ın kök nedeniyle aynı aileden yanlış bir tahsilat iddiasıydı.
     */
    const partnerMsg = isRequest
      ? `BagajPark: Yeni rezervasyon talebi — ${shopName}. Kod: ${shortId} Tutar: ${priceTr}`
      : `BagajPark: Yeni onayli rezervasyon — ${shopName}. Kod: ${shortId} Tutar: ${priceTr}`;

    const p = normalizeTrGsm10(partnerPhone ?? undefined);
    if (p) {
      await this.sendSms(p, partnerMsg, bookingId);
    } else {
      logger.debug({ bookingId }, "partner_sms_skipped_no_phone");
    }

    const adminMsg = `BagajPark [Admin]: ${isRequest ? "Yeni talep" : "Yeni onayli rezervasyon"} — ${shopName}. ${shortId} ${priceTr}`;
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
    const shortId = bookingShortCode(bookingId);

    // 1. E-posta Bildirimi
    const adminEmails = (process.env.ADMIN_EMAILS ?? "")
      .split(",")
      .map((e) => e.trim().toLowerCase())
      .filter(Boolean);

    const emailSubject = `[Admin] BagajPark: Yeni Şikayet Bildirimi! ⚠️ (Rez: ${shortId})`;
    const emailBody = `Merhaba,\n\nRezervasyon hakkında yeni bir şikayet açıldı.\n\nRezervasyon Kodu: ${shortId}\nŞikayet Nedeni: ${reason}`;
    /* Sikayet: ton `alert`; neden hucresi de vurgulu basilir. */
    const emailHtml = renderEmailHtml({
      locale: "tr",
      tone: "alert",
      heading: "Yeni Şikayet Bildirimi! ⚠️",
      paragraphs: ["Bir rezervasyon için şikayet/itiraz oluşturulmuştur."],
      rows: [
        { label: "Rezervasyon Kodu", value: shortId },
        { label: "Şikayet Nedeni", value: reason, emphasized: true },
      ],
      footer: "BagajPark — Yönetim Masası",
    });

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

  /**
   * Yeni kullanıcı kaydında admin e-postalarına bilgilendirme gönderir.
   * Esnaf başvurusu ayrıca admin GSM listesine SMS de alır — onay bekleyen bir
   * işlem olduğu için booking/dispute ile aynı aciliyet sınıfında. Misafir
   * kaydında SMS yok: hacim çok daha yüksek olabilir, bilgilendirme e-posta
   * yeterli (alert fatigue — bkz. observability kuralları).
   */
  async notifyAdminsForNewUser(params: {
    name: string | null;
    email: string | null;
    phone: string | null;
    role: "GUEST" | "PARTNER";
    source: string;
  }): Promise<void> {
    const { name, email, phone, role, source } = params;
    const identity = email ?? phone ?? "—";
    const roleLabel = role === "PARTNER" ? "Esnaf Başvurusu" : "Yeni Misafir Kaydı";

    const adminEmails = (process.env.ADMIN_EMAILS ?? "")
      .split(",")
      .map((e) => e.trim().toLowerCase())
      .filter(Boolean);

    const emailSubject = `[Admin] BagajPark: ${roleLabel} (${identity})`;
    const emailBody = `Merhaba,\n\nYeni bir kullanıcı kaydoldu.\n\nAd: ${name ?? "—"}\nE-posta/Telefon: ${identity}\nKayıt türü: ${roleLabel}\nKaynak: ${source}`;
    /* Bilgilendirme: ton `info`. */
    const emailHtml = renderEmailHtml({
      locale: "tr",
      tone: "info",
      heading: roleLabel,
      paragraphs: [],
      rows: [
        { label: "Ad", value: name ?? "—" },
        { label: "E-posta/Telefon", value: identity },
        { label: "Kaynak", value: source },
      ],
      footer: "BagajPark — Yönetim Masası",
    });

    for (const adminEmail of adminEmails) {
      if (adminEmail.includes("@")) {
        void this.sendEmail(adminEmail, emailSubject, emailBody, undefined, emailHtml).catch((e) => {
          logger.error({ err: e, adminEmail, source }, "notifyAdminsForNewUser_email_failed");
        });
      }
    }

    if (role !== "PARTNER") return;
    if (!isNetgsmConfigured()) {
      logger.debug({ source }, "netgsm_off_skipping_new_partner_sms");
      return;
    }
    const msg = `BagajPark [Admin]: Yeni esnaf basvurusu — ${name ?? identity}`;
    for (const adminNo of parseAdminGsmNumbers()) {
      await this.sendSms(adminNo, msg);
    }
  }

  async notifyCheckIn(email: string, bookingId: string, locale: string = "tr"): Promise<void> {
    /**
     * NEDEN 6 DİL (2026-08-25'te ölçüldü): `tr`/`en` dışındaki 4 dil (`de`/`fr`/
     * `ja`/`fa`) hem başlık/gövdede hem de aşağıdaki mühür listesinde Türkçe'ye
     * düşüyordu. Yalnızca üstteki cümleyi çevirip mühür listesini İngilizce
     * bırakmak da yanlış olurdu — misafir yarı Fransızca yarı İngilizce bir
     * e-posta alırdı.
     */
    const content =
      {
        tr: { subject: "Valiziniz Güvende! 🔒", body: "Valiziniz teslim alındı." },
        en: { subject: "Your Luggage is Safe! 🔒", body: "Your luggage has been received." },
        de: { subject: "Ihr Gepäck ist sicher! 🔒", body: "Ihr Gepäck wurde entgegengenommen." },
        fr: { subject: "Vos bagages sont en sécurité ! 🔒", body: "Vos bagages ont été déposés." },
        ja: { subject: "お荷物は安全です！🔒", body: "お荷物をお預かりしました。" },
        fa: { subject: "چمدان شما امن است! 🔒", body: "چمدان شما تحویل گرفته شد." },
      }[locale] ?? { subject: "Valiziniz Güvende! 🔒", body: "Valiziniz teslim alındı." };

    const sealCopy =
      {
        tr: {
          bagLabel: (i: number, size: string) => `Valiz ${i} (${size})`,
          sealWord: "mühür",
          intro: "Atanan mühür seri numaraları:",
          outro: "Check-in sırasında kaydedildi. Teslim alırken valizlerinizle karşılaştırın.",
        },
        en: {
          bagLabel: (i: number, size: string) => `Bag ${i} (${size})`,
          sealWord: "seal",
          intro: "Seal serial numbers assigned:",
          outro: "Recorded at check-in. Use these to match your bags at pick-up.",
        },
        de: {
          bagLabel: (i: number, size: string) => `Gepäckstück ${i} (${size})`,
          sealWord: "Siegel",
          intro: "Zugewiesene Siegel-Seriennummern:",
          outro: "Bei der Anmeldung erfasst. Vergleichen Sie diese bei der Abholung mit Ihrem Gepäck.",
        },
        fr: {
          bagLabel: (i: number, size: string) => `Bagage ${i} (${size})`,
          sealWord: "scellé",
          intro: "Numéros de série des scellés attribués :",
          outro: "Enregistré lors du dépôt. Utilisez ces numéros pour identifier vos bagages au retrait.",
        },
        ja: {
          bagLabel: (i: number, size: string) => `バッグ${i}（${size}）`,
          sealWord: "シール",
          intro: "割り当てられたシール番号:",
          outro: "チェックイン時に記録されました。受け取り時にお荷物と照合してください。",
        },
        fa: {
          bagLabel: (i: number, size: string) => `چمدان ${i} (${size})`,
          sealWord: "مهر",
          intro: "شماره‌های سریال مهر اختصاص‌یافته:",
          outro: "هنگام تحویل ثبت شد. هنگام تحویل‌گیری با چمدان‌های خود مطابقت دهید.",
        },
      }[locale] ?? {
        bagLabel: (i: number, size: string) => `Bag ${i} (${size})`,
        sealWord: "seal",
        intro: "Seal serial numbers assigned:",
        outro: "Recorded at check-in. Use these to match your bags at pick-up.",
      };

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
      const lines = seals
        .map((s) => `• ${sealCopy.bagLabel(s.bagIndex, s.bagSize)}: ${sealCopy.sealWord} #${s.sealNumber}`)
        .join("\n");
      textBody += `\n\n${sealCopy.intro}\n${lines}\n\n${sealCopy.outro}`;
      const items = seals
        .map(
          (s) =>
            `<li>${escapeHtml(sealCopy.bagLabel(s.bagIndex, s.bagSize))}: <strong>#${s.sealNumber}</strong></li>`,
        )
        .join("");
      htmlBody = `<p>${escapeHtml(content.body)}</p><p><strong>${escapeHtml(sealCopy.intro)}</strong></p><ul>${items}</ul><p style="font-size:13px;color:#555">${escapeHtml(sealCopy.outro)}</p>`;
    }

    if (email.includes("@")) {
      await this.sendEmail(email, content.subject, textBody, bookingId, htmlBody);
    }
  }

  async notifyCheckOut(email: string, bookingId: string, locale: string = "tr"): Promise<void> {
    const content = {
      tr: { subject: "İyi Yolculuklar! 👋", body: "Valiziniz size teslim edildi." },
      en: { subject: "Safe Travels! 👋", body: "Your luggage has been delivered to you." },
      de: { subject: "Gute Reise! 👋", body: "Ihr Gepäck wurde Ihnen übergeben." },
      fr: { subject: "Bon voyage ! 👋", body: "Vos bagages vous ont été remis." },
      ja: { subject: "良い旅を！👋", body: "お荷物をお渡ししました。" },
      fa: { subject: "سفر خوبی داشته باشید! 👋", body: "چمدان شما به شما تحویل داده شد." },
    }[locale] ?? { subject: "İyi Yolculuklar! 👋", body: "Valiziniz size teslim edildi." };

    if (email.includes("@")) {
      await this.sendEmail(email, content.subject, content.body, bookingId);
    }
  }
}

export const notificationService = new NotificationService();
