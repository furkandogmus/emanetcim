"use server";

import { auth } from "@/auth";
import { shopService } from "@/services/ShopService";
import prisma from "@/lib/db";
import { revalidatePathAllLocales } from "@/lib/revalidate-locales";

function revalidateAdmin() {
  revalidatePathAllLocales("/admin");
  revalidatePathAllLocales("/admin/applications");
  revalidatePathAllLocales("/admin/seals");
  revalidatePathAllLocales("/admin/campaigns");
}

export async function approveShopAction(shopId: string) {
  const session = await auth();

  if (session?.user?.role !== "ADMIN") {
    throw new Error("Only admins can approve shops");
  }

  const success = await shopService.approveShop(shopId);

  if (success) {
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

export async function markSealRequestShippedAction(sealRequestId: string) {
  const session = await auth();
  if (session?.user?.role !== "ADMIN") {
    throw new Error("Unauthorized");
  }

  await prisma.sealRequest.update({
    where: { id: sealRequestId },
    data: { status: "SHIPPED", updatedAt: new Date() },
  });
  revalidatePathAllLocales("/admin/seals");
  return { success: true as const };
}

export async function createCampaignAction(data: {
  name: string;
  message?: string;
  discountPercent?: number;
  isActive?: boolean;
  endsAt?: Date | null;
}) {
  const session = await auth();
  if (session?.user?.role !== "ADMIN") throw new Error("Unauthorized");

  await prisma.campaign.create({
    data: {
      name: data.name.trim(),
      message: data.message?.trim() || null,
      discountPercent: data.discountPercent ?? null,
      isActive: data.isActive ?? true,
      endsAt: data.endsAt ?? null,
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

  await prisma.campaign.update({
    where: { id },
    data,
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
