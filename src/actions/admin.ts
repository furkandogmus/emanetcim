"use server";

import { getClientIpOrNull } from "@/lib/client-ip";

import prisma from "@/lib/db";
import { revalidatePathAllLocales } from "@/lib/revalidate-locales";
import { z } from "zod";
import { sealService } from "@/services/SealService";
import { updatePlatformSettings } from "@/services/PlatformSettingsService";
import { assertAdmin } from "@/lib/action-auth";

export async function updatePlatformSettingsAction(data: unknown) {
  const actor = await assertAdmin();
  // Govde `PlatformSettingsService`te; mobil yonetici ucu da onu cagirir.
  const result = await updatePlatformSettings(actor, data, { ip: await getClientIpOrNull() });
  if (!result.ok) return { success: false as const, error: "invalid_data" as const };
  revalidatePathAllLocales("/admin/platform-settings");
  revalidatePathAllLocales("/admin");
  return { success: true as const };
}

export async function bulkCreateSealsAction(fromSerial: number, toSerial: number) {
  await assertAdmin();
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
  await assertAdmin();
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
  await assertAdmin();

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
  await assertAdmin();

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
  await assertAdmin();

  await prisma.campaign.delete({ where: { id } });
  revalidatePathAllLocales("/admin/campaigns");
  return { success: true as const };
}

export async function toggleCampaignActiveAction(id: string, isActive: boolean) {
  await assertAdmin();

  await prisma.campaign.update({
    where: { id },
    data: { isActive },
  });
  revalidatePathAllLocales("/admin/campaigns");
  return { success: true as const };
}
