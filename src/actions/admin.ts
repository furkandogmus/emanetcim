"use server";

import { getClientIpOrNull } from "@/lib/client-ip";

import { revalidatePathAllLocales } from "@/lib/revalidate-locales";
import { sealService } from "@/services/SealService";
import { updatePlatformSettings } from "@/services/PlatformSettingsService";
import { assertAdmin } from "@/lib/action-auth";
import { campaignService } from "@/services/CampaignService";

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

// Kampanya govdesi (sema + denetim kaydi) `CampaignService`te; mobil yonetici ucu da onu cagirir.
export async function createCampaignAction(data: {
  name: string;
  message?: string;
  discountPercent?: number;
  isActive?: boolean;
  endsAt?: Date | null;
}) {
  const actor = await assertAdmin();
  const result = await campaignService.create(actor, data, { ip: await getClientIpOrNull() });
  if (!result.ok) return { success: false as const, error: "invalid_data" as const };
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
  const actor = await assertAdmin();
  const result = await campaignService.update(actor, id, data, { ip: await getClientIpOrNull() });
  if (!result.ok) return { success: false as const, error: result.reason };
  revalidatePathAllLocales("/admin/campaigns");
  return { success: true as const };
}

/** Basarisizlikta FIRLATIR: istemci try/catch ile bekliyor (AdminCampaignsClient). */
export async function deleteCampaignAction(id: string) {
  const actor = await assertAdmin();
  const result = await campaignService.remove(actor, id, { ip: await getClientIpOrNull() });
  if (!result.ok) throw new Error(result.reason);
  revalidatePathAllLocales("/admin/campaigns");
  return { success: true as const };
}

/** Basarisizlikta FIRLATIR (istemci try/catch ile bekliyor). */
export async function toggleCampaignActiveAction(id: string, isActive: boolean) {
  const actor = await assertAdmin();
  const result = await campaignService.setActive(actor, id, isActive, { ip: await getClientIpOrNull() });
  if (!result.ok) throw new Error(result.reason);
  revalidatePathAllLocales("/admin/campaigns");
  return { success: true as const };
}
