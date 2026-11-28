"use server";

import { getClientIp } from "@/lib/client-ip";

import prisma from "@/lib/db";
import {
  hashPassword,
  MIN_PASSWORD_LENGTH,
  MAX_PASSWORD_LENGTH,
} from "@/lib/auth-password";
import { Role } from "@prisma/client";
import { z } from "zod";
import { rateLimit } from "@/lib/rate-limit";
import { generateVerificationToken } from "@/lib/tokens";
import { sendVerificationEmail } from "@/lib/mail";
import { isBlockedSignupEmail, mailboxQuotaKey } from "@/lib/disposable-emails";
import { getLocale } from "next-intl/server";
import { normalizeTrGsm10 } from "@/lib/netgsm";
import {
  LEGAL_DOC_PRIVACY,
  LEGAL_DOC_TERMS,
  getLegalDocumentVersion,
} from "@/lib/legal-versions";
import { notificationService } from "@/services/NotificationService";
import { analyticsService } from "@/services/AnalyticsService";
import { resolveServerSessionId } from "@/lib/analytics-server";
import logger from "@/lib/logger";

const guestSchema = z.object({
  email: z.string().email(),
  password: z.string().min(MIN_PASSWORD_LENGTH).max(MAX_PASSWORD_LENGTH),
  name: z.string().min(1).max(120),
});

const partnerSchema = z.object({
  name: z.string().min(2),
  email: z.string().email().optional().or(z.literal("")),
  phone: z
    .string()
    .trim()
    .regex(/^05\d{2}\s\d{3}\s\d{2}\s\d{2}$/, "Errors.invalidTrPhone"),
  /*
    ESNAF TABANI 6'YDI, MISAFIRINKI 8 (2026-08-31'de duzeltildi). Ters
    duruyordu: esnaf misafirin adini, telefonunu ve e-postasini goruyor,
    check-in/check-out yapiyor, muhur envanterini yonetiyor. Daha yetkili rol
    daha zayif parola tabani aliyordu. Politika artik tek yerde.
  */
  password: z.string().min(MIN_PASSWORD_LENGTH).max(MAX_PASSWORD_LENGTH),
  shopName: z.string().min(2).max(200),
  shopAddress: z.string().min(5).max(500),
  shopCity: z.string().max(100).optional(),
  shopDistrict: z.string().max(100).optional(),
  shopLatitude: z.number().min(-90).max(90).nullable().optional(),
  shopLongitude: z.number().min(-180).max(180).nullable().optional(),
  /** Bir esnafın davet linkiyle geldiyse (`?ref=`) o kod. */
  referredByCode: z.string().trim().max(32).optional(),
});

export async function registerGuestAction(data: unknown) {
  const parsed = guestSchema.safeParse(data);
  if (!parsed.success) {
    return { success: false as const, error: "Errors.invalidData" };
  }
  const ip = await getClientIp();
  if (!(await rateLimit(`register_guest:${ip}`, 8, 60 * 60 * 1000))) {
    return {
      success: false as const,
      error: "Errors.tooManyRequests",
    };
  }

  const email = parsed.data.email.trim().toLowerCase();
  
  if (isBlockedSignupEmail(email)) {
    return { success: false as const, error: "Errors.invalidEmail" };
  }

  // Hash once: kayitli adres yolu da ayni sureyi harcar (zamanlama farki sizdirmasin).
  const passwordHash = await hashPassword(parsed.data.password);
  const locale = await getLocale();

  /*
    Kayitli adres yeni kayitla AYNI basariyi alir (2026-11-24): "bu e-posta
    kayitli" yaniti hesap varligini sizdiriyordu. Sahibine giris/sifirlama
    e-postasi gider. Iki yolda da e-posta atesle-unut: yanit suresi esit kalir.
  */
  const exists = await prisma.user.findUnique({ where: { email }, select: { id: true } });
  if (exists) {
    notifyExistingAccount(email, locale, "guest");
    return { success: true as const };
  }

  const user = await prisma.user.create({
    data: {
      email,
      name: parsed.data.name.trim(),
      role: Role.GUEST,
      passwordHash,
      lastIp: ip,
      legalAcceptances: {
        create: [
          {
            documentKey: LEGAL_DOC_TERMS,
            version: getLegalDocumentVersion(LEGAL_DOC_TERMS),
            ip,
          },
          {
            documentKey: LEGAL_DOC_PRIVACY,
            version: getLegalDocumentVersion(LEGAL_DOC_PRIVACY),
            ip,
          },
        ],
      },
    },
  });

  // Verify Email (sadece e-posta ile kayıt/login flowu için)
  const verificationToken = await generateVerificationToken(user.email!);
  // Atesle-unut: kayitli adres yolu ile ayni yanit suresi (hesap varligi sizmasin).
  void sendVerificationEmail(user.email!, verificationToken.token, locale).catch((err) =>
    logger.error({ err, userId: user.id }, "send_verification_email_failed"),
  );

  void notificationService
    .notifyAdminsForNewUser({
      name: user.name,
      email: user.email,
      phone: null,
      role: "GUEST",
      source: "web_email",
    })
    .catch((err) => logger.error({ err, userId: user.id }, "notify_admins_new_guest_failed"));

  analyticsService.track({
    name: "user_signed_up",
    sessionId: await resolveServerSessionId(user.id),
    userId: user.id,
    metadata: { source: "web_email", role: "GUEST" },
  });

  return { success: true as const };
}

/**
 * Kayitli hesabin sahibine "hesabin zaten var" e-postasi; kutu basina gunde 3.
 * Atesle-unut: cagiran yolun suresi e-posta gonderimine bagli olmasin.
 */
function notifyExistingAccount(email: string, locale: string, kind: "guest" | "partner"): void {
  void rateLimit(`register_existing_notice:${mailboxQuotaKey(email)}`, 3, 24 * 60 * 60 * 1000)
    .then((allowed) =>
      allowed ? notificationService.notifyExistingAccountSignupAttempt(email, locale, kind) : undefined,
    )
    .catch((err) => logger.error({ err }, "notify_existing_account_signup_failed"));
}

export async function registerPartnerApplicationAction(data: unknown) {
  const parsed = partnerSchema.safeParse(data);
  if (!parsed.success) {
    return { success: false as const, error: "Errors.invalidData" };
  }
  const ip = await getClientIp();
  if (!(await rateLimit(`register_partner:${ip}`, 5, 60 * 60 * 1000))) {
    return {
      success: false as const,
      error: "Errors.tooManyRequests",
    };
  }

  const email = parsed.data.email?.trim().toLowerCase() || null;
  if (email && isBlockedSignupEmail(email)) {
    return { success: false as const, error: "Errors.invalidEmail" };
  }
  const phoneNorm = normalizeTrGsm10(parsed.data.phone);
  if (!phoneNorm) {
    return { success: false as const, error: "Errors.invalidTrPhone" };
  }
  /*
    DEFECT_BACKLOG D9: koordinatsız kayıt sessiz bir tuzaktı — dükkan
    oluşuyor, aramada hiç görünmüyor, admin onay ekranına gelene kadar kimse
    fark etmiyordu. Form zaten zorunlu tutuyor; burası formu atlayan
    (doğrudan action çağrısı) için ikinci kapı. approveShop'taki kontrol
    üçüncü ve son kapı.
  */
  if (parsed.data.shopLatitude == null || parsed.data.shopLongitude == null) {
    return { success: false as const, error: "Errors.shopLocationRequired" };
  }

  // Hash once: kayitli hesap yolu da ayni sureyi harcar.
  const passwordHash = await hashPassword(parsed.data.password);
  const locale = await getLocale();

  /*
    Kayitli e-posta/telefon yeni basvuruyla AYNI basariyi alir (2026-11-24):
    "kayitli" yaniti hesap varligini sizdiriyordu. Hesap ve dukkan yaratilmaz;
    hesabin e-postasi varsa sahibine "giris yap, bize yaz" e-postasi gider.
  */
  const existing =
    (email ? await prisma.user.findUnique({ where: { email }, select: { email: true } }) : null) ??
    (await prisma.user.findUnique({ where: { phone: phoneNorm }, select: { email: true } }));
  if (existing) {
    if (existing.email) notifyExistingAccount(existing.email, locale, "partner");
    return { success: true as const };
  }

  // Yalnızca ESNAF hesabından üretilmiş bir kod kabul edilir — misafir
  // indirim kodlarıyla aynı alanı (`User.referralCode`) paylaşıyor ama
  // anlamları farklı, karıştırılmamalı.
  let referredByPartnerId: string | null = null;
  const referredByCode = parsed.data.referredByCode?.trim().toUpperCase();
  if (referredByCode) {
    const referrer = await prisma.user.findUnique({
      where: { referralCode: referredByCode },
      select: { id: true, role: true },
    });
    if (referrer?.role === Role.PARTNER) {
      referredByPartnerId = referrer.id;
    }
  }

  const newPartnerId = await prisma.$transaction(async (tx) => {
    const user = await tx.user.create({
      data: {
        email: email || null,
        /*
          `emailVerified` YAZILMAZ (2026-11-28): basvuru formu adresi kanitlamaz. Eskiden
          hesap "dogrulanmis" aciliyordu; baskasinin adresiyle basvuran biri, adresin
          sahibi sonradan girdiginde sifresiyle ayni hesapta kaliyordu. Kanit dogrulama
          baglantisiyla ya da girisle gelir (`markEmailVerifiedByLogin`).
        */
        name: parsed.data.name.trim(),
        phone: phoneNorm,
        role: Role.PARTNER,
        passwordHash,
        lastIp: ip,
        referredByPartnerId,
        legalAcceptances: {
          create: [
            {
              documentKey: LEGAL_DOC_TERMS,
              version: getLegalDocumentVersion(LEGAL_DOC_TERMS),
              ip,
            },
            {
              documentKey: LEGAL_DOC_PRIVACY,
              version: getLegalDocumentVersion(LEGAL_DOC_PRIVACY),
              ip,
            },
          ],
        },
      },
    });

    await tx.shop.create({
      data: {
        name: parsed.data.shopName.trim(),
        address: parsed.data.shopAddress.trim(),
        city: parsed.data.shopCity?.trim() || null,
        district: parsed.data.shopDistrict?.trim() || null,
        latitude: parsed.data.shopLatitude ?? null,
        longitude: parsed.data.shopLongitude ?? null,
        ownerId: user.id,
        isActive: false, // Admin onayı bekleyecek
      },
    });

    return user.id;
  });

  if (email) {
    // Atesle-unut: misafir kaydiyla ayni; basvuru e-posta hatasina takilmasin.
    void generateVerificationToken(email)
      .then((verificationToken) => sendVerificationEmail(email, verificationToken.token, locale))
      .catch((err) => logger.error({ err, userId: newPartnerId }, "send_verification_email_failed"));
  }

  void notificationService
    .notifyAdminsForNewUser({
      name: parsed.data.name.trim(),
      email,
      phone: phoneNorm,
      role: "PARTNER",
      source: "web_partner_application",
    })
    .catch((err) => logger.error({ err }, "notify_admins_new_partner_failed"));

  analyticsService.track({
    name: "user_signed_up",
    sessionId: await resolveServerSessionId(newPartnerId),
    userId: newPartnerId,
    metadata: { source: "web_partner_application", role: "PARTNER" },
  });

  return { success: true as const };
}
