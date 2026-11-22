"use server";

import { getClientIpOrNull } from "@/lib/client-ip";
import { revalidatePathAllLocales } from "@/lib/revalidate-locales";
import { adminUpdateFeatureFlag } from "@/services/FeatureFlagService";
import { assertAdmin } from "@/lib/action-auth";

export async function updateFeatureFlagAction(data: unknown) {
  const actor = await assertAdmin();
  // Govde `adminUpdateFeatureFlag`ta; mobil yonetici ucu da onu cagirir.
  const result = await adminUpdateFeatureFlag(actor, data, { ip: await getClientIpOrNull() });
  if (!result.ok) return { success: false as const, error: "invalid_data" as const };
  revalidatePathAllLocales("/admin/feature-flags");
  revalidatePathAllLocales("/admin");
  return { success: true as const };
}
