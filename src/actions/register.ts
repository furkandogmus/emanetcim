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
  name: z.string().min(2),
  email: z.string().email().optional().or(z.literal("")),
  phone: z.string().min(10, "Telefon numarası en az 10 karakter olmalıdır"),
  password: z.string().min(6),
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
      lastIp: ip,
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

  const email = parsed.data.email?.trim().toLowerCase() || null;
  if (email) {
    const exists = await prisma.user.findUnique({ where: { email } });
    if (exists) {
      return { success: false as const, error: "Bu e-posta adresi zaten kayıtlı." };
    }
  }

  const phone = parsed.data.phone.trim();
  const phoneExists = await prisma.user.findUnique({ where: { phone } });
  if (phoneExists) {
    return { success: false as const, error: "Bu telefon numarası zaten kayıtlı." };
  }

  const passwordHash = await hashPassword(parsed.data.password);

  await prisma.$transaction(async (tx) => {
    const user = await tx.user.create({
      data: {
        email: email || null,
        name: parsed.data.name.trim(),
        phone: phone,
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

    // Sadece e-posta girilmişse doğrulama gönder
    if (user.email) {
      const verificationToken = await generateVerificationToken(user.email);
      await sendVerificationEmail(user.email, verificationToken.token);
    }
  });

  return { success: true as const };
}
