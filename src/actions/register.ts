"use server";

import { headers } from "next/headers";
import prisma from "@/lib/db";
import { hashPassword } from "@/lib/auth-password";
import { Role } from "@prisma/client";
import { z } from "zod";
import { rateLimit } from "@/lib/rate-limit";
import { getPricingRules } from "@/lib/platform-settings";
import { generateVerificationToken } from "@/lib/tokens";
import { sendVerificationEmail } from "@/lib/mail";

const guestSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8).max(128),
  name: z.string().min(1).max(120),
});

const partnerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8).max(128),
  name: z.string().min(1).max(120),
  phone: z.string().max(32).optional(),
  shopName: z.string().min(2).max(200),
  shopAddress: z.string().min(5).max(500),
});

export async function registerGuestAction(data: unknown) {
  const parsed = guestSchema.safeParse(data);
  if (!parsed.success) {
    return { success: false as const, error: "Geçersiz form verisi." };
  }

  const h = await headers();
  const ip =
    h.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    h.get("x-real-ip") ||
    "unknown";
  if (!(await rateLimit(`register_guest:${ip}`, 8, 60 * 60 * 1000))) {
    return {
      success: false as const,
      error: "Çok fazla kayıt denemesi. Lütfen daha sonra tekrar deneyin.",
    };
  }

  const email = parsed.data.email.trim().toLowerCase();
  const exists = await prisma.user.findUnique({ where: { email } });
  if (exists) {
    return { success: false as const, error: "Bu e-posta adresi zaten kayıtlı." };
  }

  const passwordHash = await hashPassword(parsed.data.password);
  const user = await prisma.user.create({
    data: {
      email,
      name: parsed.data.name.trim(),
      role: Role.GUEST,
      passwordHash,
    },
  });

  // Verify Email (sadece e-posta ile kayıt/login flowu için)
  const verificationToken = await generateVerificationToken(user.email!);
  await sendVerificationEmail(user.email!, verificationToken.token);

  return { success: true as const };
}

export async function registerPartnerApplicationAction(data: unknown) {
  const parsed = partnerSchema.safeParse(data);
  if (!parsed.success) {
    return { success: false as const, error: "Geçersiz form verisi." };
  }

  const h = await headers();
  const ip =
    h.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    h.get("x-real-ip") ||
    "unknown";
  if (!(await rateLimit(`register_partner:${ip}`, 5, 60 * 60 * 1000))) {
    return {
      success: false as const,
      error: "Çok fazla başvuru denemesi. Lütfen daha sonra tekrar deneyin.",
    };
  }

  const email = parsed.data.email.trim().toLowerCase();
  const exists = await prisma.user.findUnique({ where: { email } });
  if (exists) {
    return { success: false as const, error: "Bu e-posta adresi zaten kayıtlı." };
  }

  const passwordHash = await hashPassword(parsed.data.password);
  const rules = await getPricingRules();

  await prisma.$transaction(async (tx) => {
    const user = await tx.user.create({
      data: {
        email,
        name: parsed.data.name.trim(),
        phone: parsed.data.phone?.trim() || null,
        role: Role.PARTNER,
        passwordHash,
      },
    });
    await tx.shop.create({
      data: {
        ownerId: user.id,
        name: parsed.data.shopName.trim(),
        address: parsed.data.shopAddress.trim(),
        isActive: false,
        capacity: rules.defaultShopCapacity,
        pricePerDay: rules.defaultPricePerDay,
      },
    });

    // Verify Email (Partner başvurusu sonrası)
    const verificationToken = await generateVerificationToken(user.email!);
    await sendVerificationEmail(user.email!, verificationToken.token);
  });

  return { success: true as const };
}
