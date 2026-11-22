import { Prisma } from "@prisma/client";
import { z } from "zod";
import prisma from "@/lib/db";
import { writeAuditLog } from "@/lib/audit-log";
import { featureFlagConfirmPhrase, isRiskyFeatureFlag } from "@/lib/admin-risky-settings";

const TTL_MS = 60_000;

export type FeatureFlagContext = {
  userId?: string;
};

type FlagRow = {
  key: string;
  enabled: boolean;
  rolloutPct: number;
  allowedUserIds: Prisma.JsonValue | null;
};

let cache: { map: Map<string, FlagRow>; at: number } | null = null;

function parseAllowlist(value: Prisma.JsonValue | null): string[] | null {
  if (value == null) return null;
  if (!Array.isArray(value)) return null;
  const out: string[] = [];
  for (const x of value) {
    if (typeof x === "string" && x.trim()) out.push(x.trim());
  }
  return out.length > 0 ? out : null;
}

function stableBucket(userId: string, flagKey: string): number {
  const s = `${flagKey}:${userId}`;
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return Math.abs(h) % 100;
}

export function invalidateFeatureFlagsCache(): void {
  cache = null;
}

async function loadMap(): Promise<Map<string, FlagRow>> {
  if (cache && Date.now() - cache.at < TTL_MS) {
    return cache.map;
  }
  const rows = await prisma.featureFlag.findMany({
    select: {
      key: true,
      enabled: true,
      rolloutPct: true,
      allowedUserIds: true,
    },
  });
  const map = new Map<string, FlagRow>();
  for (const r of rows) {
    map.set(r.key, {
      key: r.key,
      enabled: r.enabled,
      rolloutPct: r.rolloutPct,
      allowedUserIds: r.allowedUserIds,
    });
  }
  cache = { map, at: Date.now() };
  return map;
}

class FeatureFlagService {
  /**
   * Whether the flag is on for this context.
   * Missing flags are disabled by default.
   */
  async isEnabled(
    key: string,
    ctx: FeatureFlagContext
  ): Promise<boolean> {
    const map = await loadMap();
    const row = map.get(key);
    if (!row) return false;
    if (!row.enabled) return false;

    const allow = parseAllowlist(row.allowedUserIds);
    if (allow && ctx.userId && !allow.includes(ctx.userId)) {
      return false;
    }

    const pct = Math.min(100, Math.max(0, row.rolloutPct));
    if (pct >= 100) return true;
    if (!ctx.userId) {
      // Webhooks / server paths: do not apply percentage to anonymous traffic
      return true;
    }
    return stableBucket(ctx.userId, key) < pct;
  }

  async listAll(): Promise<
    {
      id: string;
      key: string;
      enabled: boolean;
      rolloutPct: number;
      allowedUserIds: Prisma.JsonValue | null;
      description: string | null;
      updatedAt: Date;
    }[]
  > {
    return prisma.featureFlag.findMany({ orderBy: { key: "asc" } });
  }
}

export const featureFlagService = new FeatureFlagService();

/* Yonetici bayrak guncellemesi — web action'i ve mobil yonetici ucunun ortak govdesi. */
export const featureFlagUpdateSchema = z.object({
  key: z.string().min(2).max(64).regex(/^[a-z0-9_]+$/),
  enabled: z.boolean(),
  rolloutPct: z.number().int().min(0).max(100),
  allowedUserIds: z.array(z.string().uuid()).max(500).default([]),
  description: z.string().max(500).optional().nullable(),
});

export type FeatureFlagAdminActor = { id: string; role: string };

export type UpdateFeatureFlagResult =
  | { ok: true }
  | { ok: false; reason: "invalid_data" | "not_found" | "confirmation_required" };

/**
 * `requireConfirmation` (mobil): riskli bayrakta `confirmation` bayragin anahtari
 * olmali. `onlyExisting` (mobil): ekran yalniz var olan bayragi duzenler; yazim
 * hatali bir anahtar sessizce yeni bayrak olusturmasin.
 */
export async function adminUpdateFeatureFlag(
  actor: FeatureFlagAdminActor,
  data: unknown,
  opts: { ip?: string | null; requireConfirmation?: boolean; confirmation?: unknown; onlyExisting?: boolean } = {},
): Promise<UpdateFeatureFlagResult> {
  const parsed = featureFlagUpdateSchema.safeParse(data);
  if (!parsed.success) return { ok: false, reason: "invalid_data" };
  const d = parsed.data;

  if (opts.onlyExisting) {
    const existing = await prisma.featureFlag.findUnique({ where: { key: d.key }, select: { id: true } });
    if (!existing) return { ok: false, reason: "not_found" };
  }
  if (opts.requireConfirmation && isRiskyFeatureFlag(d.key) && opts.confirmation !== featureFlagConfirmPhrase(d.key)) {
    return { ok: false, reason: "confirmation_required" };
  }

  const allowJson = d.allowedUserIds.length > 0 ? d.allowedUserIds : Prisma.JsonNull;
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
      description: d.description === undefined ? undefined : d.description?.trim() || null,
    },
  });
  invalidateFeatureFlagsCache();
  writeAuditLog({
    actorUserId: actor.id,
    actorRole: actor.role,
    action: "feature_flag.update",
    entityType: "FeatureFlag",
    entityId: d.key,
    metadata: { enabled: d.enabled, rolloutPct: d.rolloutPct, allowlistSize: d.allowedUserIds.length },
    ip: opts.ip ?? null,
  });
  return { ok: true };
}
