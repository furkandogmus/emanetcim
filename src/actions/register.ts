"use server";

import { headers } from "next/headers";
import prisma from "@/lib/db";
import { hashPassword } from "@/lib/auth-password";
import { Role } from "@prisma/client";
import { z } from "zod";
import { rateLimit } from "@/lib/rate-limit";
import { generateVerificationToken } from "@/lib/tokens";
import { sendVerificationEmail } from "@/lib/mail";
import { isDisposableEmail } from "@/lib/disposable-emails";
import { getLocale } from "next-intl/server";
import { normalizeTrGsm10 } from "@/lib/netgsm";

const guestSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8).max(128),
  name: z.string().min(1).max(120),
});

const partnerSchema = z.object({
  name: z.string().min(2),
  email: z.string().email().optional().or(z.literal("")),
  phone: z.string().min(1),
  password: z.string().min(6),
  shopName: z.string().min(2).max(200),
  shopAddress: z.string().min(5).max(500),
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
    },
  });

  // Verify Email (sadece e-posta ile kayıt/login flowu için)
  const locale = await getLocale();
  const verificationToken = await generateVerificationToken(user.email!);
  await sendVerificationEmail(user.email!, verificationToken.token, locale);

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

  await prisma.$transaction(async (tx) => {
    const user = await tx.user.create({
      data: {
        email: email || null,
        emailVerified: email ? new Date() : null,
        name: parsed.data.name.trim(),
        phone: phoneNorm,
        role: Role.PARTNER,
        passwordHash,
        lastIp: ip,
      },
    });

    await tx.shop.create({
      data: {
        name: parsed.data.shopName.trim(),
        address: parsed.data.shopAddress.trim(),
        ownerId: user.id,
        isActive: false, // Admin onayı bekleyecek
      },
    });
  });

  return { success: true as const };
}
