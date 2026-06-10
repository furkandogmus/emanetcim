"use server";

import { auth } from "@/auth";
import { shopService } from "@/services/ShopService";
import prisma from "@/lib/db";
import { revalidatePathAllLocales } from "@/lib/revalidate-locales";
import { Prisma } from "@prisma/client";
import { z } from "zod";
import { invalidatePricingRulesCache } from "@/lib/platform-settings";
import { sealService } from "@/services/SealService";
import { headers } from "next/headers";
import { writeAuditLog } from "@/lib/audit-log";

function revalidateAdmin() {
  revalidatePathAllLocales("/admin");
  revalidatePathAllLocales("/admin/applications");
  revalidatePathAllLocales("/admin/seals");
  revalidatePathAllLocales("/admin/campaigns");
  revalidatePathAllLocales("/admin/platform-settings");
  revalidatePathAllLocales("/admin/feature-flags");
  revalidatePathAllLocales("/admin/role-approvals");
  revalidatePathAllLocales("/admin/disputes");
}

const platformSettingsUpdateSchema = z.object({
  maxStayDays: z.number().int().min(1).max(365),
  maxBagsPerSlot: z.number().int().min(1).max(5000),
  insuranceFeeTry: z.number().min(0).max(999_999),
  earlyRefundRatio: z.number().min(0).max(1),
  cancelFixedFeeTry: z.number().min(0).max(999_999),
  defaultShopCapacity: z.number().int().min(1).max(50_000),
  defaultPricePerDay: z.number().min(0).max(999_999),
  bagMultiplierS: z.number().min(0).max(20),
  bagMultiplierM: z.number().min(0).max(20),
  bagMultiplierXl: z.number().min(0).max(20),
  platformHolidayDates: z
    .array(z.string().regex(/^\d{4}-\d{2}-\d{2}$/))
    .max(366)
    .default([]),
});

export async function updatePlatformSettingsAction(data: unknown) {
  const session = await auth();
  if (session?.user?.role !== "ADMIN") {
    throw new Error("Unauthorized");
  }
  const parsed = platformSettingsUpdateSchema.safeParse(data);
  if (!parsed.success) {
    return { success: false as const, error: "invalid_data" as const };
  }
  const d = parsed.data;
  const holidayJson =
    d.platformHolidayDates.length > 0 ? d.platformHolidayDates : Prisma.JsonNull;

  await prisma.platformSettings.upsert({
    where: { id: "default" },
    create: {
      id: "default",
      maxStayDays: d.maxStayDays,
      maxBagsPerSlot: d.maxBagsPerSlot,
      insuranceFeeTry: new Prisma.Decimal(d.insuranceFeeTry),
      earlyRefundRatio: new Prisma.Decimal(d.earlyRefundRatio),
      cancelFixedFeeTry: new Prisma.Decimal(d.cancelFixedFeeTry),
      defaultShopCapacity: d.defaultShopCapacity,
      defaultPricePerDay: new Prisma.Decimal(d.defaultPricePerDay),
      bagMultiplierS: new Prisma.Decimal(d.bagMultiplierS),
      bagMultiplierM: new Prisma.Decimal(d.bagMultiplierM),
      bagMultiplierXl: new Prisma.Decimal(d.bagMultiplierXl),
      platformHolidayDates: holidayJson,
    },
    update: {
      maxStayDays: d.maxStayDays,
      maxBagsPerSlot: d.maxBagsPerSlot,
      insuranceFeeTry: new Prisma.Decimal(d.insuranceFeeTry),
      earlyRefundRatio: new Prisma.Decimal(d.earlyRefundRatio),
      cancelFixedFeeTry: new Prisma.Decimal(d.cancelFixedFeeTry),
      defaultShopCapacity: d.defaultShopCapacity,
      defaultPricePerDay: new Prisma.Decimal(d.defaultPricePerDay),
      bagMultiplierS: new Prisma.Decimal(d.bagMultiplierS),
      bagMultiplierM: new Prisma.Decimal(d.bagMultiplierM),
      bagMultiplierXl: new Prisma.Decimal(d.bagMultiplierXl),
      platformHolidayDates: holidayJson,
    },
  });
  invalidatePricingRulesCache();
  const h = await headers();
  writeAuditLog({
    actorUserId: session.user.id ?? null,
    actorRole: session.user.role ?? "ADMIN",
    action: "platform_settings.update",
    entityType: "PlatformSettings",
    entityId: "default",
    ip:
      h.get("x-forwarded-for")?.split(",")[0]?.trim() ||
      h.get("x-real-ip") ||
      null,
  });
  revalidatePathAllLocales("/admin/platform-settings");
  revalidatePathAllLocales("/admin");
  return { success: true as const };
}

export async function approveShopAction(shopId: string) {
  const session = await auth();

  if (session?.user?.role !== "ADMIN") {
    throw new Error("Only admins can approve shops");
  }

  const success = await shopService.approveShop(shopId);

  if (success) {
    const h = await headers();
    writeAuditLog({
      actorUserId: session.user.id ?? null,
      actorRole: session.user.role ?? "ADMIN",
      action: "shop.approve",
      entityType: "Shop",
      entityId: shopId,
      ip:
        h.get("x-forwarded-for")?.split(",")[0]?.trim() ||
        h.get("x-real-ip") ||
        null,
    });
    revalidateAdmin();
  }

  return { success };
}

export async function rejectShopAction(shopId: string) {
  const session = await auth();

  if (session?.user?.role !== "ADMIN") {
    throw new Error("Only admins can reject shops");
  }

  const result = await shopService.rejectPendingShop(shopId);
  if (result.ok) {
    revalidateAdmin();
    return { success: true as const };
  }
  return { success: false as const, error: result.error };
}

export async function bulkCreateSealsAction(fromSerial: number, toSerial: number) {
  const session = await auth();
  if (session?.user?.role !== "ADMIN") {
    throw new Error("Unauthorized");
  }
  try {
    const { created } = await sealService.bulkCreateSeals(fromSerial, toSerial);
    revalidatePathAllLocales("/admin/seals");
    return { success: true as const, created };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "unknown";
    return { success: false as const, error: msg };
  }
}

export async function assignSealsToShopAction(
  shopId: string,
  count: number
) {
  const session = await auth();
  if (session?.user?.role !== "ADMIN") {
    throw new Error("Unauthorized");
  }
  try {
    const { updated } = await sealService.assignSealsToShop(shopId, count);
    revalidatePathAllLocales("/admin/seals");
    return { success: true as const, updated };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "unknown";
    return { success: false as const, error: msg };
  }
}

const createCampaignSchema = z.object({
  name: z.string().min(1).max(200).trim(),
  message: z.string().max(1000).optional(),
  discountPercent: z.number().min(0).max(100).optional(),
  isActive: z.boolean().optional(),
  endsAt: z.date().nullable().optional(),
});

const updateCampaignSchema = z.object({
  name: z.string().min(1).max(200).trim().optional(),
  message: z.string().max(1000).nullable().optional(),
  discountPercent: z.number().min(0).max(100).nullable().optional(),
  isActive: z.boolean().optional(),
  endsAt: z.date().nullable().optional(),
});

export async function createCampaignAction(data: {
  name: string;
  message?: string;
  discountPercent?: number;
  isActive?: boolean;
  endsAt?: Date | null;
}) {
  const session = await auth();
  if (session?.user?.role !== "ADMIN") throw new Error("Unauthorized");

  const parsed = createCampaignSchema.safeParse(data);
  if (!parsed.success) {
    return { success: false as const, error: "invalid_data" as const };
  }
  const d = parsed.data;

  await prisma.campaign.create({
    data: {
      name: d.name,
      message: d.message?.trim() || null,
      discountPercent: d.discountPercent ?? null,
      isActive: d.isActive ?? true,
      endsAt: d.endsAt ?? null,
    },
  });
  revalidatePathAllLocales("/admin/campaigns");
  return { success: true as const };
}

export async function updateCampaignAction(
  id: string,
  data: {
    name?: string;
    message?: string | null;
    discountPercent?: number | null;
    isActive?: boolean;
    endsAt?: Date | null;
  }
) {
  const session = await auth();
  if (session?.user?.role !== "ADMIN") throw new Error("Unauthorized");

  const parsed = updateCampaignSchema.safeParse(data);
  if (!parsed.success) {
    return { success: false as const, error: "invalid_data" as const };
  }

  await prisma.campaign.update({
    where: { id },
    data: parsed.data,
  });
  revalidatePathAllLocales("/admin/campaigns");
  return { success: true as const };
}

export async function deleteCampaignAction(id: string) {
  const session = await auth();
  if (session?.user?.role !== "ADMIN") throw new Error("Unauthorized");

  await prisma.campaign.delete({ where: { id } });
  revalidatePathAllLocales("/admin/campaigns");
  return { success: true as const };
}

export async function toggleCampaignActiveAction(id: string, isActive: boolean) {
  const session = await auth();
  if (session?.user?.role !== "ADMIN") throw new Error("Unauthorized");

  await prisma.campaign.update({
    where: { id },
    data: { isActive },
  });
  revalidatePathAllLocales("/admin/campaigns");
  return { success: true as const };
}
