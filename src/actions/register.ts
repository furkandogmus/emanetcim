"use server";

import prisma from "@/lib/db";
import { hashPassword } from "@/lib/auth-password";
import { Role } from "@prisma/client";
import { z } from "zod";

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

  const email = parsed.data.email.trim().toLowerCase();
  const exists = await prisma.user.findUnique({ where: { email } });
  if (exists) {
    return { success: false as const, error: "Bu e-posta adresi zaten kayıtlı." };
  }

  const passwordHash = await hashPassword(parsed.data.password);
  await prisma.user.create({
    data: {
      email,
      name: parsed.data.name.trim(),
      role: Role.GUEST,
      passwordHash,
    },
  });

  return { success: true as const };
}

export async function registerPartnerApplicationAction(data: unknown) {
  const parsed = partnerSchema.safeParse(data);
  if (!parsed.success) {
    return { success: false as const, error: "Geçersiz form verisi." };
  }

  const email = parsed.data.email.trim().toLowerCase();
  const exists = await prisma.user.findUnique({ where: { email } });
  if (exists) {
    return { success: false as const, error: "Bu e-posta adresi zaten kayıtlı." };
  }

  const passwordHash = await hashPassword(parsed.data.password);

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
        capacity: 10,
        pricePerDay: 50,
      },
    });
  });

  return { success: true as const };
}
