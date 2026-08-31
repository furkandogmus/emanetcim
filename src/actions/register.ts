"use server";

import { headers } from "next/headers";
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
import { isDisposableEmail } from "@/lib/disposable-emails";
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

  const h = await headers();
  const ip =
    h.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    h.get("x-real-ip") ||
    "unknown";
  if (!(await rateLimit(`register_guest:${ip}`, 8, 60 * 60 * 1000))) {
    return {
      success: false as const,
      error: "Errors.tooManyRequests",
    };
  }

  const email = parsed.data.email.trim().toLowerCase();
  
  if (isDisposableEmail(email)) {
    return { success: false as const, error: "Errors.invalidEmail" };
  }

  const exists = await prisma.user.findUnique({ where: { email } });
  if (exists) {
    return { success: false as const, error: "Errors.emailAlreadyRegistered" };
  }

  const passwordHash = await hashPassword(parsed.data.password);
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
  const locale = await getLocale();
  const verificationToken = await generateVerificationToken(user.email!);
  await sendVerificationEmail(user.email!, verificationToken.token, locale);

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

export async function registerPartnerApplicationAction(data: unknown) {
  const parsed = partnerSchema.safeParse(data);
  if (!parsed.success) {
    return { success: false as const, error: "Errors.invalidData" };
  }

  const h = await headers();
  const ip =
    h.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    h.get("x-real-ip") ||
    "unknown";
  if (!(await rateLimit(`register_partner:${ip}`, 5, 60 * 60 * 1000))) {
    return {
      success: false as const,
      error: "Errors.tooManyRequests",
    };
  }

  const email = parsed.data.email?.trim().toLowerCase() || null;
  if (email) {
    if (isDisposableEmail(email)) {
      return { success: false as const, error: "Errors.invalidEmail" };
    }
    const exists = await prisma.user.findUnique({ where: { email } });
    if (exists) {
      return { success: false as const, error: "Errors.emailAlreadyRegistered" };
    }
  }

  const phoneNorm = normalizeTrGsm10(parsed.data.phone);
  if (!phoneNorm) {
    return { success: false as const, error: "Errors.invalidTrPhone" };
  }
  const phoneExists = await prisma.user.findUnique({ where: { phone: phoneNorm } });
  if (phoneExists) {
    return { success: false as const, error: "Errors.phoneAlreadyRegistered" };
  }

  const passwordHash = await hashPassword(parsed.data.password);

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
        emailVerified: email ? new Date() : null,
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
