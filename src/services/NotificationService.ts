import logger from "../lib/logger";
import { GUEST_PUSH_COPY, type GuestPushEvent, type GuestPushVars } from "@/lib/guest-push-copy";
import { formatPhoneForDisplay } from "@/lib/phone-format";
import prisma from "../lib/db";
import { formatTryCurrency } from "@/lib/currency";
import { fetchWithTimeout } from "@/lib/async-timeout";
import { isExpoPushToken, sendExpoPush } from "@/lib/expo-push";
import {
  ADMIN_PUSH_COPY,
  adminPushLang,
  type AdminPushData,
  type AdminPushEvent,
  type AdminPushLang,
  type AdminPushVars,
} from "@/lib/admin-push-copy";
import { ANONYMIZED_EMAIL_DOMAIN } from "@/lib/anonymized-account";
import { renderEmailHtml, escapeEmailHtml, EMAIL_BRAND_COLOR } from "@/lib/email-template";
import { bcp47ForUiLocale } from "@/lib/intl-locale";
import { formatDateTimeInZone, formatTimeInZone } from "@/lib/format-datetime";
import {
  isNetgsmConfigured,
  normalizeTrGsm10,
  parseAdminGsmNumbers,
  sendNetgsmRestSms,
} from "@/lib/netgsm";
import { bookingShortCode } from "@/lib/booking-code";
import { getSiteBaseUrl } from "@/lib/site-base-url";
import { signGuestManageLinkToken } from "@/lib/guest-lookup-token";
import { bookingNotificationEmail } from "@/services/booking/guest-contact";
import { APP_STORE_BADGE, GOOGLE_PLAY_BADGE, appLinkHref, getAppStoreFlags } from "@/lib/app-stores";
import type { EmailAppBadges } from "@/lib/email-template";

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
 * Onay e-postasindaki "Uygulamayi indir" satiri: yalnizca yayindaki magazalar,
 * hicbiri yayinda degilse satir hic cizilmez. Baglar `/app`e gider ki tiklama
 * `email-onay` kaynagiyla sayilsin.
 */
async function bookingEmailAppBadges(
  domain: string,
  copy: { appRow: string; appStoreAlt: string; playAlt: string },
): Promise<EmailAppBadges | undefined> {
  const flags = await getAppStoreFlags();
  const href = appLinkHref("email-onay", domain);
  const root = domain.replace(/\/$/, "");
  const badges: EmailAppBadges["badges"] = [];
  if (flags.iosAppStoreLive) {
    badges.push({ href, src: `${root}${APP_STORE_BADGE.png}`, alt: copy.appStoreAlt, width: 151, height: 40 });
  }
  if (flags.androidPlayLive) {
    badges.push({ href, src: `${root}${GOOGLE_PLAY_BADGE.png}`, alt: copy.playAlt, width: 150, height: 58 });
  }
  return badges.length > 0 ? { label: copy.appRow, badges } : undefined;
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
      /** Resend gonderim kimligi; teslim webhook'u DOGRU satiri bununla bulur. */
      let providerMessageId: string | null = null;

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
          /*
            SAGLAYICI KIMLIGI SAKLANIYOR (2026-08-31). Resend gonderim yanitinda
            bir `id` donuyor ve teslim webhook'lari ayni degeri `email_id` olarak
            tasiyor. Bu sutun olmadigi icin webhook `updateMany({ where: {
              recipient } })` yaziyordu -- tek bir e-postanin "delivered" olayi,
            o adrese gonderilmis BUTUN bildirimlerin durumunu birden eziyordu.
            Yanit govdesi beklenmedik bir sekil alirsa `null` kalir; kayit yine
            yazilir, yalnizca eslestirme yapilamaz.
          */
          try {
            const payload: unknown = await r.json();
            if (
              payload &&
              typeof payload === "object" &&
              typeof (payload as { id?: unknown }).id === "string"
            ) {
              providerMessageId = (payload as { id: string }).id;
            }
          } catch {
            /*
              GONDERIM ZATEN BASARILI (`r.ok`). Govdeyi okuyamamak bunu
              degistirmez: kimlik yalnizca teslim olaylarini eslestirmeye yarar,
              onu kaybetmek e-postanin gitmedigi anlamina gelmez.

              Ilk halim bunu `.catch()` ile yaziyordu ve YETMIYORDU: `r.json`
              bir fonksiyon degilse cagri SENKRON firlatir, yani `.catch`
              zincire hic baglanamaz ve hata en distaki `catch`e duser -- orada
              da gonderim FAILED sayilirdi. Yani basarili bir e-posta,
              okunamayan bir govde yuzunden basarisiz raporlanacakti.
              `NotificationService.test.ts` bunu yakaladi.
            */
          }
          logger.info({ to, subject, bookingId, providerMessageId }, "notification_email_sent");
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
          providerMessageId,
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
    // Public anahtar tek kaynaktan: imaja gomulen NEXT_PUBLIC_ degeri (istemci
    // aboneligi de onunla yapiyor). VAPID_PUBLIC_KEY yalnizca eski kurulumlar icin.
    const publicKey = (process.env.VAPID_PUBLIC_KEY || process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY)?.trim();
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
   * Misafirin telefonuna e-postanin kisa esini gonderir (2026-11-18). Mobil push
   * eskiden yalnizca esnafa "yeni rezervasyon" icin gidiyordu; misafir check-in,
   * hatirlatma ya da onay isteyen valiz duzeltmesini yalnizca e-postadan ogreniyordu.
   * Ateşle-unut: e-postayi asla bekletmez ya da dusurmez.
   */
  /**
   * E-postasi olmayan (telefonla kayitli) misafir icin yalnizca push. Bildirim
   * yontemleri push'u e-postanin yaninda gonderiyordu ve cagiranlar e-posta yoksa
   * yontemi hic cagirmiyordu: telefonla kayitli misafir HICBIR bildirim almiyordu.
   * Tek seferlik olaylar icin (onay, iptal, check-in/out, valiz duzeltmesi);
   * hatirlatma isi tekrar kontrolunu e-posta kaydina gore yaptigi icin disarida.
   */
  pushGuestOnly(bookingId: string, event: GuestPushEvent, locale: string, vars: Omit<GuestPushVars, "shop"> = {}): void {
    this.pushGuest(bookingId, event, locale, vars);
  }

  private pushGuest(
    bookingId: string,
    event: GuestPushEvent,
    locale: string,
    vars: Omit<GuestPushVars, "shop"> = {},
  ): void {
    void this.pushGuestNow(bookingId, event, locale, vars).catch((err) =>
      logger.warn({ err, bookingId, event }, "guest_push_failed"),
    );
  }

  /** `pushGuest`in beklenebilir hali: en az bir cihaza gittiyse `true`. */
  private async pushGuestNow(
    bookingId: string,
    event: GuestPushEvent,
    locale: string,
    vars: Omit<GuestPushVars, "shop"> = {},
  ): Promise<boolean> {
    const booking = await prisma.booking.findUnique({
      where: { id: bookingId },
      select: { guestId: true, shop: { select: { name: true } } },
    });
    if (!booking?.guestId) return false;
    const { title, body } = pickLocale(GUEST_PUSH_COPY, locale)[event]({ shop: booking.shop.name, ...vars });
    return this.sendMobilePush(booking.guestId, title, body, bookingId);
  }

  /**
   * Verilen cihaz token'larina tek bir baslik/govde gonderir; NotificationLog YAZMAZ.
   * `sendMobilePush` ve yonetici duyurusu (`BroadcastService`) ayni yolu kullanir:
   * Android FCM, iOS Expo push, olu token temizligi tek yerde kalir.
   * `skipped`: FCM yapilandirilmamisken gonderilemeyen Android token'lari.
   * FCM cagrisinin kendisi firlatirsa hata cagirana gecer.
   */
  async deliverMobilePush(
    tokens: string[],
    title: string,
    message: string,
    bookingId?: string,
    logCtx: Record<string, unknown> = {},
    extraData: Record<string, string> = {},
  ): Promise<{ sent: number; failed: number; skipped: number; staleTokens: string[] }> {
    const serviceAccountJson = process.env.FIREBASE_SERVICE_ACCOUNT_JSON?.trim();
    /*
      iOS cihazlar Expo push token'i kaydeder (ExponentPushToken[...]): iOS'ta yerel
      token APNs'indir, FCM onu kabul etmez. Expo servisi APNs'e EAS'taki anahtarla
      iletir; Android FCM'e dogrudan gitmeye devam eder.
    */
    const expoTokens = tokens.filter((t) => isExpoPushToken(t));
    const fcmTokens = tokens.filter((t) => !isExpoPushToken(t));
    const canFcm = !!serviceAccountJson && fcmTokens.length > 0;
    let sent = 0;
    let failed = 0;
    const staleTokens: string[] = [];

    if (canFcm) {
      const { initializeApp, getApps, cert } = await import("firebase-admin/app");
      const { getMessaging } = await import("firebase-admin/messaging");

      if (getApps().length === 0) {
        initializeApp({ credential: cert(JSON.parse(serviceAccountJson!)) });
      }
      const messaging = getMessaging();

      const resp = await messaging.sendEachForMulticast({
        tokens: fcmTokens,
        notification: { title, body: message },
        data: bookingId || Object.keys(extraData).length > 0 ? { ...extraData, ...(bookingId ? { bookingId } : {}) } : undefined,
        /*
          Uygulamanin olusturdugu YUKSEK onemli "default" kanali (push.ts).
          kanal verilmezse sistem FCM'in "Miscellaneous" kanalina dusuyor:
          baslik bandi yok, esnaf yeni rezervasyonu kacirabiliyor.
        */
        android: { priority: "high", notification: { channelId: "default" } },
      });
      sent += resp.successCount;

      resp.responses.forEach((r, i) => {
        if (r.success) return;
        failed += 1;
        const code = r.error?.code;
        if (
          code === "messaging/registration-token-not-registered" ||
          code === "messaging/invalid-registration-token"
        ) {
          staleTokens.push(fcmTokens[i]);
        }
        logger.warn({ ...logCtx, err: r.error, token: fcmTokens[i] }, "mobile_push_send_failed");
      });
    }

    if (expoTokens.length > 0) {
      const expo = await sendExpoPush(expoTokens, title, message, bookingId, extraData);
      sent += expo.successCount;
      failed += expo.failures.length;
      staleTokens.push(...expo.staleTokens);
      for (const f of expo.failures) {
        logger.warn({ ...logCtx, err: f.error, token: f.token }, "mobile_push_send_failed");
      }
    }

    if (staleTokens.length > 0) {
      await prisma.mobilePushToken.deleteMany({
        where: { token: { in: staleTokens } },
      });
    }

    return { sent, failed, skipped: canFcm ? 0 : fcmTokens.length, staleTokens };
  }

  /**
   * MOBİL push gönderimi (FCM) — `sendPush` ile AYNI desen, farklı kanal.
   *
   * NEDEN VAR (DEFECT_BACKLOG D6, 2026-09-12): `MobilePushToken` token
   * topluyordu, `sendPush` çağrıları (yukarıda, yeni rezervasyon bildirimi)
   * yalnızca web-push (`PushSubscription`) tablosuna bakıyordu — mobil uygulama
   * kullanan esnaf/misafir hiçbir zaman push ALMIYORDU. Toplanan ama hiçbir işe
   * yaramayan cihaz kimliği ayrıca KVKK riskiydi.
   *
   * `VAPID_PUBLIC_KEY`/`VAPID_PRIVATE_KEY` ile BİREBİR aynı yapılandırma
   * deseni: `FIREBASE_SERVICE_ACCOUNT_JSON` tanımsızsa gönderim `SKIPPED`
   * olarak loglanır, kod yolu ÇALIŞIR ama gerçek bir gönderim yapmaz (bkz.
   * `docs/BACKLOG.md` C2). Tanımlandığında bu, o son C2 benzeri
   * eksiğin TEK gereken adımdır.
   *
   * Geçersiz/silinmiş token'lar (`registration-token-not-registered`,
   * `invalid-registration-token`) `sendPush`in 404/410 temizliğiyle aynı
   * gerekçeyle siliniyor — aksi hâlde her gönderimde aynı ölü token'a
   * boşuna istek atılır.
   */
  async sendMobilePush(
    userId: string,
    title: string,
    message: string,
    bookingId?: string,
  ): Promise<boolean> {
    const serviceAccountJson = process.env.FIREBASE_SERVICE_ACCOUNT_JSON?.trim();

    try {
      const tokens = await prisma.mobilePushToken.findMany({ where: { userId } });
      const r = await this.deliverMobilePush(
        tokens.map((t) => t.token),
        title,
        message,
        bookingId,
        { userId },
      );

      if (r.sent + r.failed > 0) {
        const anyOk = r.sent > 0;
        await prisma.notificationLog.create({
          data: {
            bookingId,
            type: "MOBILE_PUSH",
            recipient: userId,
            subject: title,
            content: message,
            status: anyOk ? "SENT" : "FAILED",
            error: anyOk ? null : "all_tokens_failed",
          },
        });
        return anyOk;
      }

      // Buraya yalnizca Expo token'i olmayan ve FCM ile gonderilemeyen durumda gelinir.
      const skipReason = !serviceAccountJson ? "fcm_not_configured" : "no_tokens";
      logger.info({ userId, title, skipReason }, "notification_mobile_push_skipped");

      await prisma.notificationLog.create({
        data: {
          bookingId,
          type: "MOBILE_PUSH",
          recipient: userId,
          subject: title,
          content: message,
          status: "SKIPPED",
          error: skipReason,
        },
      });
      return false;
    } catch (error) {
      logger.error({ error, userId }, "[Notification] Mobile Push Failed");
      return false;
    }
  }

  /**
   * Mobil cihazi kayitli butun yoneticilere push (yasakli/anonimlestirilmis disarida,
   * `audienceUserWhere` ile ayni kural). Cihaz dili `tr` ise Turkce, degilse Ingilizce.
   * Ateşle-unut cagrilir: e-posta/SMS akisini hicbir durumda bekletmez ya da dusurmez.
   */
  pushAdmins(event: AdminPushEvent, vars: AdminPushVars, data: AdminPushData): void {
    void this.pushAdminsNow(event, vars, data).catch((err) =>
      logger.warn({ err, event }, "admin_push_failed"),
    );
  }

  /** `pushAdmins`in beklenebilir hali; gonderilen cihaz sayisini dondurur. */
  async pushAdminsNow(event: AdminPushEvent, vars: AdminPushVars, data: AdminPushData): Promise<number> {
    const tokens = await prisma.mobilePushToken.findMany({
      where: {
        user: {
          role: "ADMIN",
          isBanned: false,
          OR: [{ email: null }, { NOT: { email: { endsWith: ANONYMIZED_EMAIL_DOMAIN } } }],
        },
      },
      select: { token: true, locale: true },
    });
    if (tokens.length === 0) return 0;

    const byLang = new Map<AdminPushLang, string[]>();
    for (const t of tokens) {
      const lang = adminPushLang(t.locale);
      byLang.set(lang, [...(byLang.get(lang) ?? []), t.token]);
    }

    const extraData: Record<string, string> = { adminScreen: data.adminScreen };
    if (data.disputeId) extraData.disputeId = data.disputeId;

    let sent = 0;
    for (const [lang, list] of byLang) {
      const { title, body } = ADMIN_PUSH_COPY[lang][event](vars);
      const r = await this.deliverMobilePush(list, title, body, undefined, { event }, extraData);
      sent += r.sent;
      await prisma.notificationLog.create({
        data: {
          type: "MOBILE_PUSH",
          recipient: `admins:${lang}`,
          subject: title,
          content: body,
          status: r.sent > 0 ? "SENT" : r.failed > 0 ? "FAILED" : "SKIPPED",
          error: r.sent > 0 ? null : r.failed > 0 ? "all_tokens_failed" : "fcm_not_configured",
        },
      });
    }
    return sent;
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
  async notifyBookingSuccess(
    emailOrPlaceholder: string,
    bookingId: string,
    totalPrice: number,
    locale: string = "tr",
    /**
     * Hesapsiz rezervasyon: bilet sayfasi oturum ister, misafir onu acamaz.
     * Ana dugme yerine imzali yonetim bagi gider (`signGuestManageLinkToken`).
     */
    opts?: { guestManage?: { checkOutTime: Date } },
  ): Promise<void> {
    /*
      KOK ADRES ORTAK YARDIMCIDAN (2026-08-31). Burasi yedek olarak URETIM alan
      adini SABITLIYORDU (`https://bagajpark.com`): degisken tanimsiz kalan bir
      hazirlik/deneme ortami, test kullanicilarina sessizce uretim baglantilari
      gonderiyordu. Ayrica `NEXT_PUBLIC_BASE_URL`i yok sayiyordu.
    */
    const domain = getSiteBaseUrl();
    const guestManage = opts?.guestManage && emailOrPlaceholder.includes("@");
    const bookingUrl = guestManage
      ? `${domain}/${locale}/bookings/manage/${await signGuestManageLinkToken({
          bookingId,
          email: emailOrPlaceholder,
          checkOutTime: opts.guestManage!.checkOutTime,
        })}`
      : `${domain}/${locale}/bookings/${bookingId}`;
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
        manageCta: `Rezervasyonunu yönet`,
        appRow: `Uygulamayı indir`,
        appStoreAlt: `App Store’dan İndirin`,
        playAlt: `Google Play’den Alın`,
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
        manageCta: `Manage your booking`,
        appRow: `Get the app`,
        appStoreAlt: `Download on the App Store`,
        playAlt: `Get it on Google Play`,
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
        manageCta: `Buchung verwalten`,
        appRow: `App herunterladen`,
        appStoreAlt: `Laden im App Store`,
        playAlt: `Jetzt bei Google Play`,
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
        manageCta: `Gérer ma réservation`,
        appRow: `Télécharger l'application`,
        appStoreAlt: `Télécharger dans l'App Store`,
        playAlt: `Disponible sur Google Play`,
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
        manageCta: `予約を管理する`,
        appRow: `アプリをダウンロード`,
        appStoreAlt: `App Storeからダウンロード`,
        playAlt: `Google Play で手に入れよう`,
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
        manageCta: `مدیریت رزرو`,
        appRow: `دریافت اپلیکیشن`,
        appStoreAlt: `دانلود از App Store`,
        playAlt: `دریافت از Google Play`,
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
      cta: { href: bookingUrl, label: guestManage ? content.manageCta : content.cta, variant: "button" },
      appBadges: await bookingEmailAppBadges(domain, content),
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
    this.pushGuest(bookingId, "approved", locale);
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
    this.pushGuest(bookingId, "cancelled", locale);
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
   * Kapanan rezervasyon icin misafire push + e-posta, NEDENE gore metin.
   * `cancelBooking` (silent degilse) cagirir; boylece misafir iptali, esnaf
   * iptali, yonetici iptali ve "gelmedi" ayni yoldan haber verir. Yonetici
   * aciklamasi (`note`) misafire GITMEZ: ic not olarak yazilir; esnafin "diger"
   * aciklamasi ise iptalin sebebi oldugu icin gider.
   */
  async notifyGuestBookingClosed(params: {
    bookingId: string;
    reason: "guest_cancel" | "partner_cancel" | "no_show" | "admin_cancel" | "expired_no_dropoff";
    detail?: string | null;
    note?: string | null;
    locale: string;
  }): Promise<void> {
    const { bookingId, reason, locale } = params;
    if (reason === "expired_no_dropoff") return;
    this.pushGuest(bookingId, reason === "no_show" ? "noShow" : "cancelled", locale);

    const b = await prisma.booking.findUnique({
      where: { id: bookingId },
      select: { guestEmail: true, guest: { select: { email: true } }, shop: { select: { name: true } } },
    });
    const email = b ? bookingNotificationEmail(b) : null;
    if (!b || !email) return;

    const shop = b.shop.name;
    const shopHtml = escapeEmailHtml(shop);
    const shortId = bookingShortCode(bookingId);
    const searchUrl = `${getSiteBaseUrl()}/${locale}/search`;

    const c = pickLocale({
      tr: {
        subject: "BagajPark: Rezervasyonun iptal edildi",
        heading: "Rezervasyonun iptal edildi",
        noShowSubject: "BagajPark: Seni göremedik",
        noShowHeading: "Seni göremedik",
        guest: `${shopHtml} rezervasyonunu iptal ettin. Bir ödeme yaptıysan iadesi kaydedildi.`,
        partner: `${shopHtml} rezervasyonunu iptal etti.`,
        admin: `${shopHtml} rezervasyonun BagajPark destek ekibi tarafından iptal edildi. Bir ödeme yaptıysan iadesi kaydedildi.`,
        noShow: `Rezervasyon saatinde ${shopHtml} noktasına gelmediğin için rezervasyon kapatıldı. Planların değiştiyse sorun değil; yeni bir rezervasyonla her zaman bekleriz.`,
        reasonLabel: "Neden",
        reasons: { guest_request: "Senin isteğin üzerine", shop_closed: "Dükkan o saatte kapalı", capacity: "Dükkanda yer kalmadı", other: "Diğer" },
        cta: "Başka bir nokta bul",
        footer: `Rezervasyon Kodu: ${shortId}`,
      },
      en: {
        subject: "BagajPark: Your booking was cancelled",
        heading: "Your booking was cancelled",
        noShowSubject: "BagajPark: We missed you",
        noShowHeading: "We missed you",
        guest: `You cancelled your booking at ${shopHtml}. If you paid, the refund has been recorded.`,
        partner: `${shopHtml} cancelled your booking.`,
        admin: `Your booking at ${shopHtml} was cancelled by the BagajPark support team. If you paid, the refund has been recorded.`,
        noShow: `Your booking at ${shopHtml} was closed because you did not arrive at the booked time. If your plans changed, no problem; you are welcome to book again anytime.`,
        reasonLabel: "Reason",
        reasons: { guest_request: "At your request", shop_closed: "The shop is closed at that time", capacity: "The shop has no space left", other: "Other" },
        cta: "Find another location",
        footer: `Booking code: ${shortId}`,
      },
      de: {
        subject: "BagajPark: Deine Buchung wurde storniert",
        heading: "Deine Buchung wurde storniert",
        noShowSubject: "BagajPark: Wir haben dich verpasst",
        noShowHeading: "Wir haben dich verpasst",
        guest: `Du hast deine Buchung bei ${shopHtml} storniert. Falls du bezahlt hast, wurde die Erstattung erfasst.`,
        partner: `${shopHtml} hat deine Buchung storniert.`,
        admin: `Deine Buchung bei ${shopHtml} wurde vom BagajPark-Support storniert. Falls du bezahlt hast, wurde die Erstattung erfasst.`,
        noShow: `Deine Buchung bei ${shopHtml} wurde geschlossen, weil du zur gebuchten Zeit nicht gekommen bist. Falls sich deine Pläne geändert haben, kein Problem; du kannst jederzeit neu buchen.`,
        reasonLabel: "Grund",
        reasons: { guest_request: "Auf deinen Wunsch", shop_closed: "Der Laden ist zu dieser Zeit geschlossen", capacity: "Im Laden ist kein Platz mehr", other: "Sonstiges" },
        cta: "Anderen Standort finden",
        footer: `Buchungscode: ${shortId}`,
      },
      fr: {
        subject: "BagajPark : Votre réservation a été annulée",
        heading: "Votre réservation a été annulée",
        noShowSubject: "BagajPark : Nous vous avons manqué",
        noShowHeading: "Nous vous avons manqué",
        guest: `Vous avez annulé votre réservation chez ${shopHtml}. Si vous avez payé, le remboursement a été enregistré.`,
        partner: `${shopHtml} a annulé votre réservation.`,
        admin: `Votre réservation chez ${shopHtml} a été annulée par le support BagajPark. Si vous avez payé, le remboursement a été enregistré.`,
        noShow: `Votre réservation chez ${shopHtml} a été clôturée car vous n'êtes pas venu à l'heure prévue. Si vos plans ont changé, aucun souci ; vous pouvez réserver à nouveau à tout moment.`,
        reasonLabel: "Motif",
        reasons: { guest_request: "À votre demande", shop_closed: "Le commerce est fermé à cette heure", capacity: "Le commerce n'a plus de place", other: "Autre" },
        cta: "Trouver un autre point",
        footer: `Code de réservation : ${shortId}`,
      },
      ja: {
        subject: "BagajPark: ご予約がキャンセルされました",
        heading: "ご予約がキャンセルされました",
        noShowSubject: "BagajPark: お会いできませんでした",
        noShowHeading: "お会いできませんでした",
        guest: `${shopHtml}のご予約をキャンセルしました。お支払い済みの場合、返金が記録されました。`,
        partner: `${shopHtml}がご予約をキャンセルしました。`,
        admin: `${shopHtml}のご予約はBagajParkサポートによりキャンセルされました。お支払い済みの場合、返金が記録されました。`,
        noShow: `ご予約の時間に${shopHtml}へお越しにならなかったため、ご予約を終了しました。予定が変わった場合もご心配なく。またいつでもご予約ください。`,
        reasonLabel: "理由",
        reasons: { guest_request: "お客様のご要望により", shop_closed: "その時間は店舗が閉まっています", capacity: "店舗に空きがありません", other: "その他" },
        cta: "別の店舗を探す",
        footer: `予約コード: ${shortId}`,
      },
      fa: {
        subject: "BagajPark: رزرو شما لغو شد",
        heading: "رزرو شما لغو شد",
        noShowSubject: "BagajPark: شما را ندیدیم",
        noShowHeading: "شما را ندیدیم",
        guest: `رزرو خود در ${shopHtml} را لغو کردید. اگر پرداختی انجام داده‌اید، بازپرداخت ثبت شد.`,
        partner: `${shopHtml} رزرو شما را لغو کرد.`,
        admin: `رزرو شما در ${shopHtml} توسط پشتیبانی BagajPark لغو شد. اگر پرداختی انجام داده‌اید، بازپرداخت ثبت شد.`,
        noShow: `چون در زمان رزرو به ${shopHtml} نیامدید، رزرو بسته شد. اگر برنامه‌تان تغییر کرد، اشکالی ندارد؛ هر زمان خواستید دوباره رزرو کنید.`,
        reasonLabel: "دلیل",
        reasons: { guest_request: "به درخواست شما", shop_closed: "فروشگاه در آن ساعت بسته است", capacity: "فروشگاه جای خالی ندارد", other: "سایر" },
        cta: "یافتن مکان دیگر",
        footer: `کد رزرو: ${shortId}`,
      },
    }, locale);

    // HTML ve duz metin ayri kurulur: duz metni HTML'den etiket silerek uretmek
    // kirilgandi (CodeQL) ve esnaf notunu kacirilmis haliyle (&amp;) gonderiyordu.
    const paragraphs: string[] = [];
    const textParagraphs: string[] = [];
    const plain = (s: string) => s.split(shopHtml).join(shop);
    const add = (html: string, text = plain(html)) => {
      paragraphs.push(html);
      textParagraphs.push(text);
    };
    if (reason === "no_show") add(c.noShow);
    else if (reason === "partner_cancel") {
      add(c.partner);
      const label = c.reasons[params.detail as keyof typeof c.reasons];
      if (label) add(`<strong>${c.reasonLabel}:</strong> ${label}`, `${c.reasonLabel}: ${label}`);
      if (params.detail === "other" && params.note) add(escapeEmailHtml(params.note), params.note);
    } else if (reason === "admin_cancel") add(c.admin);
    else add(c.guest);

    const subject = reason === "no_show" ? c.noShowSubject : c.subject;
    const html = renderEmailHtml({
      locale,
      tone: "muted",
      heading: reason === "no_show" ? c.noShowHeading : c.heading,
      paragraphs,
      cta: { href: searchUrl, label: c.cta, variant: "link" },
      footer: c.footer,
    });
    const text = textParagraphs.join("\n\n");
    await this.sendEmail(email, subject, text, bookingId, html);
  }

  /**
   * Yonetici esnafin rezervasyonunu iptal ettiginde ya da zorla teslim
   * ettiginde dukkan sahibine e-posta (ve zorla teslimde push; iptal push'u
   * `notifyPartnerBookingChange`ten gider). Yonetici aciklamasi esnafa gider.
   */
  async notifyPartnerAdminAction(params: {
    bookingId: string;
    kind: "cancelled" | "force_checked_out";
    note: string;
  }): Promise<void> {
    const b = await prisma.booking.findUnique({
      where: { id: params.bookingId },
      select: { shop: { select: { name: true, owner: { select: { id: true, email: true } } } } },
    });
    const owner = b?.shop.owner;
    if (!b || !owner) return;
    const shortId = bookingShortCode(params.bookingId);
    const noteHtml = escapeEmailHtml(params.note);

    // Esnaf bildirimleri Turkce gider (bkz. `notifyPartnerBookingChange`); diger diller mandal icin.
    const c = pickLocale({
      tr: {
        cancelledTitle: "Rezervasyon yönetici tarafından iptal edildi",
        checkoutTitle: "Rezervasyon yönetici tarafından teslim edildi",
        cancelledP: `${shortId} kodlu rezervasyon BagajPark yöneticisi tarafından iptal edildi; kapasiten serbest bırakıldı.`,
        checkoutP: `${shortId} kodlu rezervasyon BagajPark yöneticisi tarafından teslim edildi olarak kapatıldı. Gecikme ücreti alınmadı.`,
        noteLabel: "Açıklama",
        footer: `Rezervasyon Kodu: ${shortId}`,
      },
      en: {
        cancelledTitle: "Booking cancelled by an administrator",
        checkoutTitle: "Booking checked out by an administrator",
        cancelledP: `Booking ${shortId} was cancelled by a BagajPark administrator; your capacity has been released.`,
        checkoutP: `Booking ${shortId} was closed as checked out by a BagajPark administrator. No late fee was charged.`,
        noteLabel: "Note",
        footer: `Booking code: ${shortId}`,
      },
      de: {
        cancelledTitle: "Buchung von einem Administrator storniert",
        checkoutTitle: "Buchung von einem Administrator abgeschlossen",
        cancelledP: `Die Buchung ${shortId} wurde von einem BagajPark-Administrator storniert; deine Kapazität wurde freigegeben.`,
        checkoutP: `Die Buchung ${shortId} wurde von einem BagajPark-Administrator als abgeholt abgeschlossen. Es wurde keine Verspätungsgebühr erhoben.`,
        noteLabel: "Hinweis",
        footer: `Buchungscode: ${shortId}`,
      },
      fr: {
        cancelledTitle: "Réservation annulée par un administrateur",
        checkoutTitle: "Réservation clôturée par un administrateur",
        cancelledP: `La réservation ${shortId} a été annulée par un administrateur BagajPark ; votre capacité a été libérée.`,
        checkoutP: `La réservation ${shortId} a été clôturée comme récupérée par un administrateur BagajPark. Aucun frais de retard n'a été facturé.`,
        noteLabel: "Remarque",
        footer: `Code de réservation : ${shortId}`,
      },
      ja: {
        cancelledTitle: "管理者により予約がキャンセルされました",
        checkoutTitle: "管理者により予約が引き渡し済みになりました",
        cancelledP: `予約 ${shortId} はBagajPark管理者によりキャンセルされ、枠が解放されました。`,
        checkoutP: `予約 ${shortId} はBagajPark管理者により引き渡し済みとして終了しました。延滞料金は請求されていません。`,
        noteLabel: "メモ",
        footer: `予約コード: ${shortId}`,
      },
      fa: {
        cancelledTitle: "رزرو توسط مدیر لغو شد",
        checkoutTitle: "رزرو توسط مدیر تحویل داده شد",
        cancelledP: `رزرو ${shortId} توسط مدیر BagajPark لغو شد؛ ظرفیت شما آزاد شد.`,
        checkoutP: `رزرو ${shortId} توسط مدیر BagajPark به عنوان تحویل‌شده بسته شد. هزینه تأخیر دریافت نشد.`,
        noteLabel: "توضیح",
        footer: `کد رزرو: ${shortId}`,
      },
    }, "tr");

    const title = params.kind === "cancelled" ? c.cancelledTitle : c.checkoutTitle;
    const p = params.kind === "cancelled" ? c.cancelledP : c.checkoutP;

    if (params.kind === "force_checked_out") {
      void this.sendPush(owner.id, title, b.shop.name, params.bookingId).catch((e) =>
        logger.error({ err: e, bookingId: params.bookingId }, "notifyPartnerAdminAction_push_failed"),
      );
      void this.sendMobilePush(owner.id, title, b.shop.name, params.bookingId).catch((e) =>
        logger.error({ err: e, bookingId: params.bookingId }, "notifyPartnerAdminAction_mobile_push_failed"),
      );
    }

    if (!owner.email?.includes("@")) return;
    const html = renderEmailHtml({
      locale: "tr",
      tone: "muted",
      heading: title,
      paragraphs: [p, `<strong>${c.noteLabel}:</strong> ${noteHtml}`],
      footer: c.footer,
    });
    await this.sendEmail(owner.email, `BagajPark: ${title}`, `${p}\n\n${c.noteLabel}: ${params.note}`, params.bookingId, html);
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
    /* GOVDEYE GIREN DUKKAN ADI KACIRILIR — bkz. notifyPrelaunchInterestReceived'daki ayni desen. */
    const shopNameHtml = escapeEmailHtml(shopName);

    // Veritabanından rezervasyon durumunu ve partner e-posta adresini çekelim
    let partnerEmail: string | null = null;
    /** Push icin gerekli: bildirim kullaniciya gider, e-posta adresine degil. */
    let partnerUserId: string | null = null;
    let isRequest = true;
    try {
      const b = await prisma.booking.findUnique({
        where: { id: bookingId },
        /*
          DAR SECIM: `owner: true` esnafin `passwordHash`ini ve base64 avatarini
          da getiriyordu; burada gereken iki alan var.
        */
        include: { shop: { select: { owner: { select: { id: true, email: true } } } } },
      });
      if (b) {
        partnerEmail = b.shop?.owner?.email ?? null;
        partnerUserId = b.shop?.owner?.id ?? null;
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
          `<strong>${shopNameHtml}</strong> mağazanıza yeni bir rezervasyon talebi ulaştı. Onaylama veya reddetme işlemlerini gerçekleştirmek için lütfen partner panelinize giriş yapın.`,
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
          `<strong>${shopNameHtml}</strong> mağazanıza yeni bir onaylı rezervasyon geldi. Müşteri bagajı teslim etmek üzere dükkanınıza gelecektir.`,
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

    /*
      PUSH BILDIRIMI -- esnafin telefonu titresin.

      NEDEN EKLENDI (2026-09-01'de olculdu): `sendPush` bu kod tabaninda
      TANIMLIYDI, UYGULANMISTI ve HICBIR YERDEN CAGRILMIYORDU. Yani VAPID
      anahtarlari, `PushSubscription` tablosu, `/api/push/subscribe` ucu ve
      `WebPushOptIn` bileseni -- abonelik tarafinin tamami kuruluydu ama tek bir
      bildirim gonderilmiyordu.

      Bu, esnafi kanalsiz birakiyordu. Diger uclarin durumu:
        - SMS  : `sendNetgsmRestSms` bilerek devre disi, sessizce `{ok:false}`
        - Mobil push: token toplaniyor, gonderim kodu HIC YOK
        - E-posta: calisiyor -- ama dukkan isleten esnaf e-postaya bakmaz

      Yeni rezervasyon esnafin ISINI baslatan olaydir; farkina saatler sonra
      varmasi, misafirin kapida beklemesi demek.

      METIN TURKCE: bu bildirim yalnizca Turkiye'deki esnafa gidiyor -- ustteki
      e-posta da ayni sebeple tek dilde (bkz. `panelUrl` yorumu).

      `.catch` ZORUNLU: yakalanmamis red Node'da sureci dusurur ve bir bildirim
      hatasi tum sunucuyu indirir (`unhandled-rejection` mandali, tavan 0).
      Bildirim gonderimi rezervasyonu BLOKLAMAMALI, o yuzden beklenmiyor.
    */
    if (partnerUserId) {
      const pushTitle = isRequest
        ? "Yeni rezervasyon talebi 🎒"
        : "Yeni onaylı rezervasyon 🎒";
      const pushBody = `${shopName} — ${priceTr} · Kod: ${shortId}`;
      void this.sendPush(partnerUserId, pushTitle, pushBody, bookingId).catch((e) => {
        logger.error({ err: e, partnerUserId, bookingId }, "notifyPartnerAndAdmins_partner_push_failed");
      });
      // DEFECT_BACKLOG D6: web-push'un yanına MOBİL push -- esnaf uygulamayı
      // kullanıyorsa telefonu da titresin.
      void this.sendMobilePush(partnerUserId, pushTitle, pushBody, bookingId).catch((e) => {
        logger.error({ err: e, partnerUserId, bookingId }, "notifyPartnerAndAdmins_partner_mobile_push_failed");
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
   * Misafir rezervasyonu IPTAL ETTI ya da DEGISTIRDI: esnafin telefonu titrer.
   *
   * NEDEN (2026-11-21): esnaf yalnizca yeni rezervasyondan haberdar ediliyordu;
   * iptal ve saat/valiz degisikligi ancak liste 30 sn'de bir yenilenince
   * gorunuyordu (ve yalniz sekme odaktayken). Misafir gelmeyecekken esnaf hazirlik
   * yapiyor, saat degismisken eski saati bekliyordu.
   *
   * Servis cagirir (`lifecycle.ts`), yani web ve mobil ayni bildirimi uretir.
   * Metin Turkce: bu bildirim yalnizca Turkiye'deki esnafa gider (bkz.
   * `notifyPartnerAndAdminsForNewPaidBooking`). Ateşle-unut: cagiran `.catch` tasir.
   */
  async notifyPartnerBookingChange(params: {
    bookingId: string;
    kind: "cancelled" | "modified";
  }): Promise<void> {
    const b = await prisma.booking.findUnique({
      where: { id: params.bookingId },
      select: {
        checkInTime: true,
        bagCountS: true,
        bagCountM: true,
        bagCountXl: true,
        guest: { select: { name: true } },
        shop: { select: { name: true, timezone: true, owner: { select: { id: true } } } },
      },
    });
    const partnerUserId = b?.shop?.owner?.id;
    if (!b || !partnerUserId) return;

    const when = formatDateTimeInZone(b.checkInTime, {
      locale: "tr-TR",
      timeZone: b.shop.timezone || "Europe/Istanbul",
      dateStyle: "medium",
      timeStyle: "short",
    });
    const guestName = b.guest?.name?.trim() || "Misafir";
    const bags = b.bagCountS + b.bagCountM + b.bagCountXl;
    const shortId = bookingShortCode(params.bookingId);
    const title = params.kind === "cancelled" ? "Rezervasyon iptal edildi" : "Rezervasyon değişti";
    const body =
      params.kind === "cancelled"
        ? `${guestName} · ${when} · Kod: ${shortId}`
        : `${guestName} · yeni bırakma ${when} · ${bags} valiz · Kod: ${shortId}`;

    void this.sendPush(partnerUserId, title, body, params.bookingId).catch((e) => {
      logger.error({ err: e, partnerUserId, bookingId: params.bookingId }, "notifyPartnerBookingChange_push_failed");
    });
    void this.sendMobilePush(partnerUserId, title, body, params.bookingId).catch((e) => {
      logger.error({ err: e, partnerUserId, bookingId: params.bookingId }, "notifyPartnerBookingChange_mobile_push_failed");
    });
  }

  /**
   * Şikayet açıldığında admin GSM listesine SMS ve tüm admin e-postalarına e-posta gönderir.
   */
  async notifyAdminsForDispute(params: {
    bookingId: string;
    reason: string;
    disputeId?: string;
  }): Promise<void> {
    const { bookingId, reason } = params;
    const shortId = bookingShortCode(bookingId);

    this.pushAdmins(
      "dispute",
      { code: shortId, reason },
      params.disputeId ? { adminScreen: "dispute", disputeId: params.disputeId } : { adminScreen: "dispute" },
    );

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
        // Derinlemesine savunma: `reason` artik cagiran tarafta enum'a
        // dogrulaniyor (bkz. createDisputeAction), ama bu servis o garantiye
        // guvenmeden de guvenli kalmali.
        { label: "Şikayet Nedeni", value: escapeEmailHtml(reason), emphasized: true },
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
        // `name` kayit formundan geliyor, tamamen kullanici kontrollu
        // (2026-09-10'da bulundu) — kacirilmadan tabloya girerse admin
        // gelen kutusuna HTML/baglanti enjekte edilebilirdi.
        { label: "Ad", value: escapeEmailHtml(name ?? "—") },
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
    this.pushAdmins("partnerApplication", { name: name ?? identity }, { adminScreen: "applications" });
    if (!isNetgsmConfigured()) {
      logger.debug({ source }, "netgsm_off_skipping_new_partner_sms");
      return;
    }
    const msg = `BagajPark [Admin]: Yeni esnaf basvurusu — ${name ?? identity}`;
    for (const adminNo of parseAdminGsmNumbers()) {
      await this.sendSms(adminNo, msg);
    }
  }

  /**
   * Esnaf on kaydi (/esnaf). Hesap yok, geri donus bu e-postaya bagli: esnaf
   * "sizi arayacagiz" sozuyle ayriliyor.
   */
  async notifyAdminsForPartnerLead(params: {
    fullName: string;
    phone: string;
    shopName: string | null;
    address: string;
  }): Promise<void> {
    const { fullName, phone, shopName, address } = params;
    this.pushAdmins("partnerLead", { name: shopName ?? fullName }, { adminScreen: "partnerLeads" });
    const adminEmails = (process.env.ADMIN_EMAILS ?? "")
      .split(",")
      .map((e) => e.trim().toLowerCase())
      .filter(Boolean);

    const subject = `[Admin] BagajPark: Esnaf ön kaydı (${shopName ?? fullName})`;
    const body = `Yeni esnaf ön kaydı.\n\nAd: ${fullName}\nTelefon: ${phone}\nDükkan: ${shopName ?? "—"}\nAdres: ${address}`;
    // Tum alanlar formdan geliyor; kacirilmadan tabloya girerse admin kutusuna HTML enjekte edilir.
    const html = renderEmailHtml({
      locale: "tr",
      tone: "info",
      heading: "Esnaf ön kaydı",
      paragraphs: ["Esnaf aranmayı bekliyor."],
      rows: [
        { label: "Ad Soyad", value: escapeEmailHtml(fullName) },
        { label: "Telefon", value: escapeEmailHtml(phone), emphasized: true },
        { label: "Dükkan", value: escapeEmailHtml(shopName ?? "—") },
        { label: "Adres", value: escapeEmailHtml(address) },
      ],
      footer: "BagajPark — Yönetim Masası",
    });

    for (const adminEmail of adminEmails) {
      if (adminEmail.includes("@")) {
        void this.sendEmail(adminEmail, subject, body, undefined, html).catch((e) => {
          logger.error({ err: e, adminEmail }, "notifyAdminsForPartnerLead_email_failed");
        });
      }
    }
  }

  /** "Araci ol" basvurusu (`AffiliateService.submitApplication`). Yalnizca yoneticiye, Turkce. */
  async notifyAdminsForAffiliateApplication(params: {
    displayName: string;
    type: string;
    contactEmail: string | null;
    contactPhone: string | null;
    applicationNote: string | null;
  }): Promise<void> {
    const adminEmails = (process.env.ADMIN_EMAILS ?? "")
      .split(",")
      .map((e) => e.trim().toLowerCase())
      .filter(Boolean);
    const { displayName, type, contactEmail, contactPhone, applicationNote } = params;
    this.pushAdmins("affiliateApplication", { name: displayName }, { adminScreen: "affiliates" });
    const subject = `[Admin] BagajPark: Aracı başvurusu (${displayName})`;
    const body = `Yeni aracı başvurusu.\n\nAd: ${displayName}\nTür: ${type}\nE-posta: ${contactEmail ?? "—"}\nTelefon: ${contactPhone ?? "—"}\nPaylaşım: ${applicationNote ?? "—"}`;
    // Alanlar formdan geliyor: kacirilmadan tabloya girmez.
    const html = renderEmailHtml({
      locale: "tr",
      tone: "info",
      heading: "Aracı başvurusu",
      paragraphs: ["Onay bekliyor: Yönetim → Aracılar."],
      rows: [
        { label: "Ad", value: escapeEmailHtml(displayName), emphasized: true },
        { label: "Tür", value: escapeEmailHtml(type) },
        { label: "E-posta", value: escapeEmailHtml(contactEmail ?? "—") },
        { label: "Telefon", value: escapeEmailHtml(contactPhone ?? "—") },
        { label: "Paylaşım", value: escapeEmailHtml(applicationNote ?? "—") },
      ],
      footer: "BagajPark — Yönetim Masası",
    });
    for (const adminEmail of adminEmails) {
      if (adminEmail.includes("@")) {
        void this.sendEmail(adminEmail, subject, body, undefined, html).catch((e) => {
          logger.error({ err: e, adminEmail }, "notifyAdminsForAffiliateApplication_email_failed");
        });
      }
    }
  }

  /**
   * `locale` VARSAYILANI YOK (2026-09-02'de kaldirildi).
   *
   * Imza `locale: string = "tr"` idi ve bu varsayilan iki yerde birden yanlis
   * dil gonderilmesini SESSIZ hale getiriyordu: mobil check-in ucu parametreyi
   * hic vermiyordu (yani her misafire Turkce gidiyordu), web action'i ise
   * `getLocale()` veriyordu -- o ESNAFIN arayuz dili, e-postayi alan MISAFIRIN
   * degil. Almanca panel kullanan bir esnaf check-in yapinca Japon misafire
   * Almanca "valizinizi teslim aldik" gidiyordu.
   *
   * Varsayilansiz imza, unutmayi derleme hatasina cevirir. Dogru kaynak
   * `Booking.locale`.
   */
  async notifyCheckIn(email: string, bookingId: string, locale: string): Promise<void> {
    this.pushGuest(bookingId, "checkIn", locale);
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

  async notifyCheckOut(email: string, bookingId: string, locale: string): Promise<void> {
    this.pushGuest(bookingId, "checkOut", locale);
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

  /**
   * YAKLASAN CHECK-IN / CHECK-OUT hatirlatmasi -- MISAFIRE.
   *
   * NEDEN BURADA (2026-09-02): bu iki e-posta `booking-reminders` ucunun
   * icinde, duz Turkce string olarak yaziliyordu. `hardcoded-copy` mandalinin
   * kendi notu onlari "kalan borcun icindeki tek MISAFIR yuzeyi" diye
   * isaretlemis: "Japon bir misafire Turkce e-posta gidiyor."
   *
   * Duzeltilememesinin sebebi metnin yeri degil, VERI eksikligiydi -- misafirin
   * dili hicbir yerde saklanmiyordu. `Booking.locale` eklendi; metinler de
   * kod tabaninin geri kalaniyla ayni yoldan geciyor artik: `pickLocale` +
   * `renderEmailHtml`, ve `notification-locale-coverage` mandali her dili
   * tasidiklarini dogruluyor.
   *
   * Saat DUKKANIN diliminde bicimlenir (`formatDateTimeInZone`); tarih
   * bicimlendirmesinin sunucunun dilimine dusmesi ayri bir hataydi ve ayni gun
   * duzeltildi.
   */
  async sendStayReminder(
    email: string,
    bookingId: string,
    params: {
      kind: "check-in" | "check-out";
      shopName: string;
      at: Date;
      timeZone: string;
    },
    locale: string,
  ) {
    const when = formatDateTimeInZone(params.at, {
      locale: bcp47ForUiLocale(locale),
      timeZone: params.timeZone,
      dateStyle: "medium",
      timeStyle: "short",
    });
    const shop = params.shopName;
    const girisMi = params.kind === "check-in";
    this.pushGuest(bookingId, girisMi ? "reminderCheckIn" : "reminderCheckOut", locale, { time: when });

    const content = pickLocale(
      {
        tr: girisMi
          ? {
              subject: "BagajPark: Bırakma saatiniz yaklaşıyor 🎒",
              heading: "Bırakma saatiniz yaklaşıyor 🎒",
              p1: `Bagajınızı __SHOP__ noktasına bırakma zamanınız yaklaşıyor. QR kodunuzu göstermeyi unutmayın.`,
              row1: "Nokta",
              row2: "Bırakma",
            }
          : {
              subject: "BagajPark: Valizinizi alma saatiniz yaklaşıyor 🔔",
              heading: "Valizinizi alma saatiniz yaklaşıyor 🔔",
              p1: `__SHOP__ noktasındaki bagajınızı teslim alma zamanınız yaklaşıyor. Geç teslim almalarda ek ücret uygulanabilir.`,
              row1: "Nokta",
              row2: "Alma",
            },
        en: girisMi
          ? {
              subject: "BagajPark: Your drop-off time is near 🎒",
              heading: "Your drop-off time is near 🎒",
              p1: `It is almost time to drop your luggage off at __SHOP__. Remember to show your QR code.`,
              row1: "Location",
              row2: "Drop-off",
            }
          : {
              subject: "BagajPark: Your pick-up time is near 🔔",
              heading: "Your pick-up time is near 🔔",
              p1: `It is almost time to collect your luggage from __SHOP__. Late pick-ups may incur an extra charge.`,
              row1: "Location",
              row2: "Pick-up",
            },
        de: girisMi
          ? {
              subject: "BagajPark: Ihre Abgabezeit rückt näher 🎒",
              heading: "Ihre Abgabezeit rückt näher 🎒",
              p1: `Es ist fast Zeit, Ihr Gepäck bei __SHOP__ abzugeben. Denken Sie an Ihren QR-Code.`,
              row1: "Standort",
              row2: "Abgabe",
            }
          : {
              subject: "BagajPark: Ihre Abholzeit rückt näher 🔔",
              heading: "Ihre Abholzeit rückt näher 🔔",
              p1: `Es ist fast Zeit, Ihr Gepäck bei __SHOP__ abzuholen. Bei verspäteter Abholung können Zusatzkosten anfallen.`,
              row1: "Standort",
              row2: "Abholung",
            },
        fr: girisMi
          ? {
              subject: "BagajPark : l'heure de dépôt approche 🎒",
              heading: "L'heure de dépôt approche 🎒",
              p1: `Il est bientôt temps de déposer vos bagages à __SHOP__. N'oubliez pas votre code QR.`,
              row1: "Point",
              row2: "Dépôt",
            }
          : {
              subject: "BagajPark : l'heure de récupération approche 🔔",
              heading: "L'heure de récupération approche 🔔",
              p1: `Il est bientôt temps de récupérer vos bagages à __SHOP__. Une récupération tardive peut entraîner des frais.`,
              row1: "Point",
              row2: "Récupération",
            },
        ja: girisMi
          ? {
              subject: "BagajPark: お預けのお時間が近づいています 🎒",
              heading: "お預けのお時間が近づいています 🎒",
              p1: `__SHOP__ でお荷物をお預けいただくお時間が近づいています。QRコードをご提示ください。`,
              row1: "場所",
              row2: "お預け",
            }
          : {
              subject: "BagajPark: お受け取りのお時間が近づいています 🔔",
              heading: "お受け取りのお時間が近づいています 🔔",
              p1: `__SHOP__ でお荷物をお受け取りいただくお時間が近づいています。お受け取りが遅れると追加料金が発生する場合があります。`,
              row1: "場所",
              row2: "お受け取り",
            },
        fa: girisMi
          ? {
              subject: "BagajPark: زمان تحویل چمدان شما نزدیک است 🎒",
              heading: "زمان تحویل چمدان شما نزدیک است 🎒",
              p1: `زمان تحویل چمدان شما در __SHOP__ نزدیک است. لطفاً کد QR خود را نشان دهید.`,
              row1: "مکان",
              row2: "تحویل",
            }
          : {
              subject: "BagajPark: زمان دریافت چمدان شما نزدیک است 🔔",
              heading: "زمان دریافت چمدان شما نزدیک است 🔔",
              p1: `زمان دریافت چمدان شما از __SHOP__ نزدیک است. دریافت با تأخیر ممکن است هزینه اضافی داشته باشد.`,
              row1: "مکان",
              row2: "دریافت",
            },
      },
      locale,
    );

    /*
      `shop` esnafin kendi yazdigi dukkan adi, DUZ METIN ve HTML govdesine
      farkli kacisla girer (bkz. escapeEmailHtml() basindaki gerekce): metin
      govdesi kacirilirsa kullaniciya `&amp;` gosterir, HTML govdesi
      kacirilmazsa baglanti/isaretleme enjeksiyonuna acik kalir
      (2026-09-10'da bulundu — bu fonksiyon o duzeltmenin disinda kalmisti).
      `content.p1` `__SHOP__` yer tutucusuyla uretiliyor; burada iki ayri
      degerle dolduruluyor.
    */
    const shopHtml = escapeEmailHtml(shop);
    const p1Text = content.p1.replace("__SHOP__", shop);
    const p1Html = content.p1.replace("__SHOP__", shopHtml);
    const body = `${p1Text}\n\n${content.row1}: ${shop}\n${content.row2}: ${when}`;
    const html = renderEmailHtml({
      locale,
      heading: content.heading,
      paragraphs: [p1Html],
      rows: [
        { label: content.row1, value: shopHtml },
        { label: content.row2, value: when },
      ],
      footer: "BagajPark",
    });

    if (email.includes("@")) {
      await this.sendEmail(email, content.subject, body, bookingId, html);
    }
  }

  /**
   * Alma saati gecmis, valizi hala dukkanda olan MISAFIRE hatirlatma: push + e-posta.
   *
   * Takvim ve tekrar kontrolu burada DEGIL, `OverdueGuestReminderService`te: bu yontem
   * cagrildiginda o slot zaten `BookingEvent` olarak sahiplenilmistir. Iki kanal
   * birbirinden bagimsiz: e-postasiz misafire push, cihazsiz misafire e-posta gider.
   * Ucretten soz edilmez (karar yok, 2026-11-23). Donen deger kanal basina gercek sonuc.
   */
  async sendOverdueGuestReminder(params: {
    bookingId: string;
    /** `bookingNotificationEmail(booking)`; yoksa yalnizca push. */
    email: string | null;
    /** Hesapli misafir bilet sayfasini acar; hesapsiz misafire imzali yonetim bagi gider. */
    hasAccount: boolean;
    locale: string;
    checkOutAt: Date;
    shop: {
      name: string;
      address: string | null;
      openingTime: string | null;
      closingTime: string | null;
      open247: boolean;
      timeZone: string;
    };
    now?: Date;
  }): Promise<{ push: boolean; email: boolean }> {
    const { bookingId, locale, shop } = params;
    const push = this.pushGuestNow(bookingId, "overdue", locale).catch((err) => {
      logger.warn({ err, bookingId }, "overdue_guest_push_failed");
      return false;
    });

    const email = params.email;
    if (!email || !email.includes("@")) return { push: await push, email: false };

    const domain = getSiteBaseUrl();
    /*
      Yonetim baginin omru `checkOutTime + 1 gun`le sinirli; alma saati gunler once
      gectiyse bag e-postayla birlikte 1 saatte olurdu. Hatirlatma anini baz almak
      bagi bir sonraki hatirlatmaya (24 sa) kadar acik tutar.
    */
    const now = params.now ?? new Date();
    const bookingUrl = params.hasAccount
      ? `${domain}/${locale}/bookings/${bookingId}`
      : `${domain}/${locale}/bookings/manage/${await signGuestManageLinkToken({
          bookingId,
          email,
          checkOutTime: params.checkOutAt > now ? params.checkOutAt : now,
          now,
        })}`;

    const plannedAt = formatDateTimeInZone(params.checkOutAt, {
      locale: bcp47ForUiLocale(locale),
      timeZone: shop.timeZone,
      dateStyle: "medium",
      timeStyle: "short",
    });

    const content = pickLocale(
      {
        tr: {
          subject: "BagajPark: Valiziniz hâlâ dükkanda 🧳",
          heading: "Valiziniz sizi bekliyor 🧳",
          p1: `Valiziniz hâlâ __SHOP__ noktasında, güvende. Size uygun bir saatte uğrayıp teslim alabilirsiniz. Dükkanın telefon ve WhatsApp bilgisi rezervasyon sayfanızda.`,
          rowShop: "Nokta",
          rowAddress: "Adres",
          rowHours: "Çalışma saatleri",
          rowPlanned: "Planlanan alma",
          open247: "7/24 açık",
          cta: "Rezervasyonu görüntüle",
        },
        en: {
          subject: "BagajPark: Your luggage is still at the shop 🧳",
          heading: "Your luggage is waiting for you 🧳",
          p1: `Your luggage is still safe at __SHOP__. Drop by whenever it suits you to pick it up. The shop's phone and WhatsApp details are on your booking page.`,
          rowShop: "Location",
          rowAddress: "Address",
          rowHours: "Opening hours",
          rowPlanned: "Planned pick-up",
          open247: "Open 24/7",
          cta: "View booking",
        },
        de: {
          subject: "BagajPark: Ihr Gepäck ist noch im Geschäft 🧳",
          heading: "Ihr Gepäck wartet auf Sie 🧳",
          p1: `Ihr Gepäck ist noch sicher bei __SHOP__. Holen Sie es ab, wann es Ihnen passt. Telefon und WhatsApp des Geschäfts finden Sie auf Ihrer Buchungsseite.`,
          rowShop: "Standort",
          rowAddress: "Adresse",
          rowHours: "Öffnungszeiten",
          rowPlanned: "Geplante Abholung",
          open247: "Rund um die Uhr geöffnet",
          cta: "Buchung ansehen",
        },
        fr: {
          subject: "BagajPark : vos bagages sont toujours au commerce 🧳",
          heading: "Vos bagages vous attendent 🧳",
          p1: `Vos bagages sont toujours en sécurité chez __SHOP__. Passez les récupérer quand cela vous convient. Le téléphone et le WhatsApp du commerce figurent sur votre page de réservation.`,
          rowShop: "Point",
          rowAddress: "Adresse",
          rowHours: "Horaires",
          rowPlanned: "Récupération prévue",
          open247: "Ouvert 24h/24, 7j/7",
          cta: "Voir la réservation",
        },
        ja: {
          subject: "BagajPark: お荷物はまだ店舗でお預かりしています 🧳",
          heading: "お荷物がお待ちしています 🧳",
          p1: `お荷物は __SHOP__ で安全にお預かりしています。ご都合のよい時間にお受け取りください。店舗の電話番号とWhatsAppはご予約ページに記載されています。`,
          rowShop: "場所",
          rowAddress: "住所",
          rowHours: "営業時間",
          rowPlanned: "予定受け取り時刻",
          open247: "24時間営業",
          cta: "予約を見る",
        },
        fa: {
          subject: "BagajPark: چمدان شما هنوز در فروشگاه است 🧳",
          heading: "چمدان شما منتظر شماست 🧳",
          p1: `چمدان شما همچنان به‌طور امن در __SHOP__ نگهداری می‌شود. هر زمان که برایتان مناسب است برای تحویل گرفتن آن مراجعه کنید. شماره تلفن و واتس‌اپ فروشگاه در صفحه رزرو شما آمده است.`,
          rowShop: "مکان",
          rowAddress: "نشانی",
          rowHours: "ساعات کاری",
          rowPlanned: "زمان تحویل برنامه‌ریزی‌شده",
          open247: "شبانه‌روزی",
          cta: "مشاهده رزرو",
        },
      },
      locale,
    );

    const hours = shop.open247
      ? content.open247
      : shop.openingTime && shop.closingTime
        ? `${shop.openingTime} - ${shop.closingTime}`
        : null;

    // Dukkan adi ve adresi esnafin yazdigi duz metin: HTML govdesine kacirilarak girer.
    const shopHtml = escapeEmailHtml(shop.name);
    const rows: { label: string; text: string; html: string }[] = [
      { label: content.rowShop, text: shop.name, html: shopHtml },
      ...(shop.address
        ? [{ label: content.rowAddress, text: shop.address, html: escapeEmailHtml(shop.address) }]
        : []),
      ...(hours ? [{ label: content.rowHours, text: hours, html: escapeEmailHtml(hours) }] : []),
      { label: content.rowPlanned, text: plannedAt, html: plannedAt },
    ];

    const body =
      `${content.p1.replace("__SHOP__", shop.name)}\n\n` +
      rows.map((r) => `${r.label}: ${r.text}`).join("\n") +
      `\n\n${content.cta}: ${bookingUrl}`;
    const html = renderEmailHtml({
      locale,
      heading: content.heading,
      paragraphs: [content.p1.replace("__SHOP__", shopHtml)],
      rows: rows.map((r) => ({ label: r.label, value: r.html })),
      cta: { href: bookingUrl, label: content.cta, variant: "button" },
      footer: "BagajPark",
    });

    const [pushed, emailed] = await Promise.all([
      push,
      this.sendEmail(email, content.subject, body, bookingId, html),
    ]);
    return { push: pushed, email: emailed };
  }

  /**
   * Gec birakma bildirimi (`LateDropoffService`): hatirlatma, "dukkan bekliyor" ya da
   * "kapandi". Once push; ulasmadiysa (cihaz yok, gonderim basarisiz) e-posta. Uc
   * hatirlatma 30 dk icinde gidiyor: iki kanaldan birden gondermek gurultu olurdu.
   */
  async sendLateDropoffNotice(params: {
    bookingId: string;
    kind: "reminder" | "hold" | "closed";
    email: string | null;
    hasAccount: boolean;
    locale: string;
    /** reminder: kapanis ani; hold: bekletmenin bittigi an; closed: kapanis ani. */
    at: Date;
    checkOutAt: Date;
    shop: { name: string; phone: string | null; timeZone: string };
    now?: Date;
  }): Promise<{ push: boolean; email: boolean }> {
    const { bookingId, kind, locale, shop } = params;
    const time = formatTimeInZone(params.at, { locale: bcp47ForUiLocale(locale), timeZone: shop.timeZone });
    const phone = formatPhoneForDisplay(shop.phone);
    const event = kind === "reminder" ? "lateDropoff" : kind === "hold" ? "lateHold" : "lateClosed";
    const pushed = await this.pushGuestNow(bookingId, event, locale, { time, phone }).catch((err) => {
      logger.warn({ err, bookingId, kind }, "late_dropoff_push_failed");
      return false;
    });
    const email = params.email;
    if (pushed || !email || !email.includes("@")) return { push: pushed, email: false };

    const domain = getSiteBaseUrl();
    const now = params.now ?? new Date();
    const ctaUrl =
      kind === "closed"
        ? `${domain}/${locale}/search`
        : params.hasAccount
          ? `${domain}/${locale}/bookings/${bookingId}`
          : `${domain}/${locale}/bookings/manage/${await signGuestManageLinkToken({
              bookingId,
              email,
              checkOutTime: params.checkOutAt > now ? params.checkOutAt : now,
              now,
            })}`;

    const c = pickLocale(
      {
        tr: {
          reminderSubject: "BagajPark: Bırakma saatin geçti",
          reminderHeading: "Bırakma saatin geçti",
          reminder: "__SHOP__ rezervasyonun saat __TIME__ itibarıyla otomatik kapanacak. Geliyorsan dükkanı ara__PHONE__; gelemiyorsan yeni bir rezervasyon yap.",
          holdSubject: "BagajPark: Dükkan seni bekliyor",
          holdHeading: "Dükkan seni bekliyor",
          hold: "__SHOP__ rezervasyonunu senin için açık tutuyor. Son saat: __TIME__.",
          closedSubject: "BagajPark: Rezervasyonun kapandı",
          closedHeading: "Rezervasyonun kapandı",
          closed: "Bırakma saatin geçtiği için __SHOP__ rezervasyonun kapandı. Yeni bir rezervasyon yapabilirsin.",
          ctaBooking: "Rezervasyonu görüntüle",
          ctaSearch: "Yeni rezervasyon yap",
        },
        en: {
          reminderSubject: "BagajPark: Your drop-off time has passed",
          reminderHeading: "Your drop-off time has passed",
          reminder: "Your booking at __SHOP__ closes automatically at __TIME__. If you are on your way, call the shop__PHONE__; otherwise make a new booking.",
          holdSubject: "BagajPark: The shop is waiting for you",
          holdHeading: "The shop is waiting for you",
          hold: "__SHOP__ is holding your booking until __TIME__.",
          closedSubject: "BagajPark: Your booking was closed",
          closedHeading: "Your booking was closed",
          closed: "Your booking at __SHOP__ was closed because the drop-off time passed. You can make a new booking.",
          ctaBooking: "View booking",
          ctaSearch: "Make a new booking",
        },
        de: {
          reminderSubject: "BagajPark: Deine Abgabezeit ist vorbei",
          reminderHeading: "Deine Abgabezeit ist vorbei",
          reminder: "Deine Buchung bei __SHOP__ wird um __TIME__ automatisch geschlossen. Wenn du unterwegs bist, ruf den Laden an__PHONE__; sonst buche neu.",
          holdSubject: "BagajPark: Der Laden wartet auf dich",
          holdHeading: "Der Laden wartet auf dich",
          hold: "__SHOP__ hält deine Buchung bis __TIME__ offen.",
          closedSubject: "BagajPark: Deine Buchung wurde geschlossen",
          closedHeading: "Deine Buchung wurde geschlossen",
          closed: "Deine Buchung bei __SHOP__ wurde geschlossen, weil die Abgabezeit überschritten wurde. Du kannst neu buchen.",
          ctaBooking: "Buchung ansehen",
          ctaSearch: "Neu buchen",
        },
        fr: {
          reminderSubject: "BagajPark : l'heure de dépôt est passée",
          reminderHeading: "L'heure de dépôt est passée",
          reminder: "Votre réservation chez __SHOP__ sera clôturée automatiquement à __TIME__. Si vous arrivez, appelez le commerce__PHONE__ ; sinon, faites une nouvelle réservation.",
          holdSubject: "BagajPark : le commerce vous attend",
          holdHeading: "Le commerce vous attend",
          hold: "__SHOP__ garde votre réservation jusqu'à __TIME__.",
          closedSubject: "BagajPark : votre réservation a été clôturée",
          closedHeading: "Votre réservation a été clôturée",
          closed: "Votre réservation chez __SHOP__ a été clôturée car l'heure de dépôt est dépassée. Vous pouvez réserver à nouveau.",
          ctaBooking: "Voir la réservation",
          ctaSearch: "Nouvelle réservation",
        },
        ja: {
          reminderSubject: "BagajPark: 預け入れ時間を過ぎました",
          reminderHeading: "預け入れ時間を過ぎました",
          reminder: "__SHOP__のご予約は__TIME__に自動で終了します。向かっている場合は店舗にお電話ください__PHONE__。難しい場合は新しくご予約ください。",
          holdSubject: "BagajPark: 店舗がお待ちしています",
          holdHeading: "店舗がお待ちしています",
          hold: "__SHOP__は__TIME__までご予約を保持しています。",
          closedSubject: "BagajPark: ご予約が終了しました",
          closedHeading: "ご予約が終了しました",
          closed: "預け入れ時間を過ぎたため、__SHOP__のご予約は終了しました。新しくご予約いただけます。",
          ctaBooking: "予約を見る",
          ctaSearch: "新しく予約する",
        },
        fa: {
          reminderSubject: "BagajPark: زمان تحویل دادن گذشته است",
          reminderHeading: "زمان تحویل دادن گذشته است",
          reminder: "رزرو شما در __SHOP__ ساعت __TIME__ به‌طور خودکار بسته می‌شود. اگر در راه هستید با فروشگاه تماس بگیرید__PHONE__؛ وگرنه رزرو جدیدی ثبت کنید.",
          holdSubject: "BagajPark: فروشگاه منتظر شماست",
          holdHeading: "فروشگاه منتظر شماست",
          hold: "__SHOP__ رزرو شما را تا ساعت __TIME__ نگه می‌دارد.",
          closedSubject: "BagajPark: رزرو شما بسته شد",
          closedHeading: "رزرو شما بسته شد",
          closed: "چون زمان تحویل دادن گذشت، رزرو شما در __SHOP__ بسته شد. می‌توانید دوباره رزرو کنید.",
          ctaBooking: "مشاهده رزرو",
          ctaSearch: "رزرو جدید",
        },
      },
      locale,
    );

    const subject = kind === "reminder" ? c.reminderSubject : kind === "hold" ? c.holdSubject : c.closedSubject;
    const heading = kind === "reminder" ? c.reminderHeading : kind === "hold" ? c.holdHeading : c.closedHeading;
    const template = kind === "reminder" ? c.reminder : kind === "hold" ? c.hold : c.closed;
    // Dukkan adi ve telefonu esnafin yazdigi duz metin: HTML'e kacirilarak girer.
    const fill = (shopText: string, phoneText: string) =>
      template.replace("__SHOP__", shopText).replace("__TIME__", time).replace("__PHONE__", phoneText);
    const text = fill(shop.name, phone ? ` (${phone})` : "");
    const html = fill(escapeEmailHtml(shop.name), phone ? ` (${escapeEmailHtml(phone)})` : "");
    const cta = kind === "closed" ? c.ctaSearch : c.ctaBooking;

    const emailed = await this.sendEmail(
      email,
      subject,
      `${text}\n\n${cta}: ${ctaUrl}`,
      bookingId,
      renderEmailHtml({
        locale,
        heading,
        paragraphs: [html],
        cta: { href: ctaUrl, label: cta, variant: "button" },
        footer: `BagajPark · ${bookingShortCode(bookingId)}`,
      }),
    );
    return { push: false, email: emailed };
  }

  /**
   * Gec birakma +45 dk: esnafa "misafir gelmedi, su saatte kapanacak". Metin Turkce
   * (esnaf bildirimleri gibi, bkz. `notifyPartnerBookingChange`). En az bir kanal
   * ulastiysa `true`.
   */
  async notifyPartnerLateDropoff(params: { bookingId: string; closeAt: Date }): Promise<boolean> {
    const b = await prisma.booking.findUnique({
      where: { id: params.bookingId },
      select: {
        guest: { select: { name: true } },
        shop: { select: { timezone: true, owner: { select: { id: true } } } },
      },
    });
    const partnerUserId = b?.shop?.owner?.id;
    if (!b || !partnerUserId) return false;
    const time = formatTimeInZone(params.closeAt, { locale: "tr-TR", timeZone: b.shop.timezone || "Europe/Istanbul" });
    const guestName = b.guest?.name?.trim() || "Misafir";
    const title = "Misafir henüz gelmedi";
    const body = `${guestName} · Kod ${bookingShortCode(params.bookingId)} · Otomatik kapanış ${time}. Valizi aldıysan teslim al; misafir aradıysa "Misafiri bekle"ye bas.`;
    const [web, mobile] = await Promise.all([
      this.sendPush(partnerUserId, title, body, params.bookingId),
      this.sendMobilePush(partnerUserId, title, body, params.bookingId),
    ]);
    return web || mobile;
  }

  /**
   * CHECK-IN SONRASI fiyat artışı -- MİSAFİRİN ONAYINI BEKLİYOR.
   *
   * NEDEN VAR (DEFECT_BACKLOG D5, 2026-09-12): esnaf artık check-in
   * tamamlandıktan sonra (misafir gittikten sonra) fiyatı artıran bir valiz
   * düzeltmesini tek başına uygulayamıyor -- `bag-revision.ts`teki
   * `GUEST_APPROVAL_REQUIRED` kapısı öneriyi bekletiyor. Misafir bunu
   * `/bookings/{id}` (hesaplı) veya token'lı yönetim sayfasında (hesapsız)
   * görüp onaylıyor/reddediyor; bu e-posta olmadan misafir orayı hiç açmazdı.
   */
  async sendBagRevisionApprovalRequest(
    email: string,
    bookingId: string,
    params: { shopName: string; extraAmount: number; newTotal: number },
    locale: string,
  ) {
    const shop = params.shopName;
    const bcp47 = bcp47ForUiLocale(locale);
    const extra = formatTryCurrency(params.extraAmount, bcp47);
    const newTotal = formatTryCurrency(params.newTotal, bcp47);
    this.pushGuest(bookingId, "bagRevision", locale, { total: newTotal });
    const baseUrl = getSiteBaseUrl();
    const link = `${baseUrl}/${locale}/bookings/${bookingId}`;

    const content = pickLocale(
      {
        tr: {
          subject: "BagajPark: Valiz sayınız değişti, onayınız gerekiyor 🧳",
          heading: "Valiz sayınız değişti, onayınız gerekiyor 🧳",
          p1: `__SHOP__ noktasındaki valiz sayınız düzeltildi ve tutarınız __EXTRA__ arttı. Yeni tutarı onaylamanız veya reddetmeniz gerekiyor.`,
          row1: "Nokta",
          row2: "Yeni tutar",
        },
        en: {
          subject: "BagajPark: Your bag count changed, approval needed 🧳",
          heading: "Your bag count changed, approval needed 🧳",
          p1: `Your bag count at __SHOP__ was corrected and your total increased by __EXTRA__. Please approve or reject the new total.`,
          row1: "Location",
          row2: "New total",
        },
        de: {
          subject: "BagajPark: Ihre Gepäckanzahl hat sich geändert 🧳",
          heading: "Ihre Gepäckanzahl hat sich geändert 🧳",
          p1: `Ihre Gepäckanzahl bei __SHOP__ wurde korrigiert und Ihr Betrag ist um __EXTRA__ gestiegen. Bitte stimmen Sie dem neuen Betrag zu oder lehnen Sie ihn ab.`,
          row1: "Standort",
          row2: "Neuer Betrag",
        },
        fr: {
          subject: "BagajPark : votre nombre de bagages a changé 🧳",
          heading: "Votre nombre de bagages a changé 🧳",
          p1: `Votre nombre de bagages à __SHOP__ a été corrigé et votre montant a augmenté de __EXTRA__. Merci d'approuver ou de refuser le nouveau montant.`,
          row1: "Point",
          row2: "Nouveau montant",
        },
        ja: {
          subject: "BagajPark: お荷物の数が変更されました、承認が必要です 🧳",
          heading: "お荷物の数が変更されました、承認が必要です 🧳",
          p1: `__SHOP__ でのお荷物の数が修正され、金額が__EXTRA__増加しました。新しい金額を承認または拒否してください。`,
          row1: "場所",
          row2: "新しい金額",
        },
        fa: {
          subject: "BagajPark: تعداد چمدان شما تغییر کرد، نیاز به تأیید دارید 🧳",
          heading: "تعداد چمدان شما تغییر کرد، نیاز به تأیید دارید 🧳",
          p1: `تعداد چمدان شما در __SHOP__ اصلاح شد و مبلغ شما __EXTRA__ افزایش یافت. لطفاً مبلغ جدید را تأیید یا رد کنید.`,
          row1: "مکان",
          row2: "مبلغ جدید",
        },
      },
      locale,
    );

    const shopHtml = escapeEmailHtml(shop);
    const p1Text = content.p1.replace("__SHOP__", shop).replace("__EXTRA__", extra);
    const p1Html = content.p1.replace("__SHOP__", shopHtml).replace("__EXTRA__", extra);
    const body = `${p1Text}\n\n${content.row1}: ${shop}\n${content.row2}: ${newTotal}\n\n${link}`;
    const html = renderEmailHtml({
      locale,
      heading: content.heading,
      paragraphs: [p1Html],
      rows: [
        { label: content.row1, value: shopHtml },
        { label: content.row2, value: newTotal },
      ],
      footer: "BagajPark",
    });

    if (email.includes("@")) {
      await this.sendEmail(email, content.subject, body, bookingId, html);
    }
  }
}

export const notificationService = new NotificationService();
