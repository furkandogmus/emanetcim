"use server";

import { auth } from "@/auth";
import { headers } from "next/headers";
import { z } from "zod";
import prisma from "@/lib/db";
import { Prisma } from "@prisma/client";
import { revalidatePathAllLocales } from "@/lib/revalidate-locales";
import { writeAuditLog } from "@/lib/audit-log";
import { invalidateFeatureFlagsCache } from "@/services/FeatureFlagService";

const updateSchema = z.object({
  key: z.string().min(2).max(64).regex(/^[a-z0-9_]+$/),
  enabled: z.boolean(),
  rolloutPct: z.number().int().min(0).max(100),
  allowedUserIds: z.array(z.string().uuid()).max(500).default([]),
  description: z.string().max(500).optional().nullable(),
});

export async function updateFeatureFlagAction(data: unknown) {
  const session = await auth();
  if (session?.user?.role !== "ADMIN") {
    throw new Error("Unauthorized");
  }
  const parsed = updateSchema.safeParse(data);
  if (!parsed.success) {
    return { success: false as const, error: "invalid_data" as const };
  }
  const d = parsed.data;
  const allowJson =
    d.allowedUserIds.length > 0 ? d.allowedUserIds : Prisma.JsonNull;

  await prisma.featureFlag.upsert({
    where: { key: d.key },
    create: {
      key: d.key,
      enabled: d.enabled,
      rolloutPct: d.rolloutPct,
      allowedUserIds: allowJson,
      description: d.description?.trim() || null,
    },
    update: {
      enabled: d.enabled,
      rolloutPct: d.rolloutPct,
      allowedUserIds: allowJson,
      description:
        d.description === undefined
          ? undefined
          : d.description?.trim() || null,
    },
  });

  invalidateFeatureFlagsCache();
  const h = await headers();
  writeAuditLog({
    actorUserId: session.user.id ?? null,
    actorRole: session.user.role ?? "ADMIN",
    action: "feature_flag.update",
    entityType: "FeatureFlag",
    entityId: d.key,
    metadata: {
      enabled: d.enabled,
      rolloutPct: d.rolloutPct,
      allowlistSize: d.allowedUserIds.length,
    },
    ip:
      h.get("x-forwarded-for")?.split(",")[0]?.trim() ||
      h.get("x-real-ip") ||
      null,
  });

  revalidatePathAllLocales("/admin/feature-flags");
  revalidatePathAllLocales("/admin");
  return { success: true as const };
}
