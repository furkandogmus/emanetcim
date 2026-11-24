import { Prisma } from "@prisma/client";
import { z } from "zod";
import prisma from "@/lib/db";
import { writeAuditLog } from "@/lib/audit-log";
import { moneyToNumber } from "@/lib/money";

/**
 * Yonetici kampanyalari: web action'lari ve mobil yonetici ucu ayni govdeyi cagirir.
 * Sema ve denetim kaydi burada; once action'daydi ve hic denetim izi yazmiyordu.
 */
export type CampaignActor = { id: string; role: string };
type Ctx = { ip?: string | null };

/** Web `Date`, mobil ISO metin gonderir; ikisi de ayni sinirdan gecer. */
const dateInput = z
  .union([z.date(), z.string().datetime()])
  .transform((v) => (v instanceof Date ? v : new Date(v)))
  .refine((d) => !Number.isNaN(d.getTime()));

export const campaignCreateSchema = z.object({
  name: z.string().trim().min(1).max(200),
  message: z.string().max(1000).nullable().optional(),
  discountPercent: z.number().min(0).max(100).nullable().optional(),
  isActive: z.boolean().optional(),
  endsAt: dateInput.nullable().optional(),
});

export const campaignUpdateSchema = z.object({
  name: z.string().trim().min(1).max(200).optional(),
  message: z.string().max(1000).nullable().optional(),
  discountPercent: z.number().min(0).max(100).nullable().optional(),
  isActive: z.boolean().optional(),
  endsAt: dateInput.nullable().optional(),
});

/** Okuma ile yazma arasinda baska yonetici sildiyse Prisma P2025 firlatir; 500 degil `not_found`. */
function isRecordNotFound(err: unknown): boolean {
  return err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2025";
}

export type CampaignWriteResult =
  | { ok: true; id: string }
  | { ok: false; reason: "invalid_data" | "not_found" };

export class CampaignService {
  /** Yeniden eskiye, en fazla 50 (web listesiyle ayni). */
  listForAdmin() {
    return prisma.campaign.findMany({ orderBy: [{ createdAt: "desc" }, { id: "desc" }], take: 50 });
  }

  /** Acik kampanya sayisi ve aciklardaki en yuksek indirim yuzdesi. */
  async activeSummary() {
    const active = await prisma.campaign.findMany({ where: { isActive: true }, select: { discountPercent: true } });
    return {
      activeCount: active.length,
      maxActiveDiscount: active.reduce((m, c) => Math.max(m, moneyToNumber(c.discountPercent ?? 0)), 0),
    };
  }

  async create(actor: CampaignActor, raw: unknown, ctx: Ctx = {}): Promise<CampaignWriteResult> {
    const parsed = campaignCreateSchema.safeParse(raw);
    if (!parsed.success) return { ok: false, reason: "invalid_data" };
    const d = parsed.data;
    const row = await prisma.campaign.create({
      data: {
        name: d.name,
        message: d.message?.trim() || null,
        discountPercent: d.discountPercent ?? null,
        isActive: d.isActive ?? true,
        endsAt: d.endsAt ?? null,
      },
      select: { id: true },
    });
    writeAuditLog({
      actorUserId: actor.id,
      actorRole: actor.role,
      action: "campaign.create",
      entityType: "Campaign",
      entityId: row.id,
      metadata: { name: d.name, discountPercent: d.discountPercent ?? null },
      ip: ctx.ip ?? null,
    });
    return { ok: true, id: row.id };
  }

  async update(actor: CampaignActor, id: string, raw: unknown, ctx: Ctx = {}): Promise<CampaignWriteResult> {
    const parsed = campaignUpdateSchema.safeParse(raw);
    if (!parsed.success) return { ok: false, reason: "invalid_data" };
    const d = parsed.data;
    if (!(await this.exists(id))) return { ok: false, reason: "not_found" };
    try {
      await prisma.campaign.update({
        where: { id },
        data: { ...d, ...(d.message !== undefined ? { message: d.message?.trim() || null } : {}) },
      });
    } catch (err) {
      if (isRecordNotFound(err)) return { ok: false, reason: "not_found" };
      throw err;
    }
    // Yalniz acma/kapama degistiyse eylem adi onu soyler: denetim kaydinda "duraklatildi" aranir.
    const onlyToggle = Object.keys(d).length === 1 && d.isActive !== undefined;
    writeAuditLog({
      actorUserId: actor.id,
      actorRole: actor.role,
      action: onlyToggle ? (d.isActive ? "campaign.resume" : "campaign.pause") : "campaign.update",
      entityType: "Campaign",
      entityId: id,
      metadata: onlyToggle ? undefined : { fields: Object.keys(d) },
      ip: ctx.ip ?? null,
    });
    return { ok: true, id };
  }

  setActive(actor: CampaignActor, id: string, isActive: unknown, ctx: Ctx = {}): Promise<CampaignWriteResult> {
    if (typeof isActive !== "boolean") return Promise.resolve({ ok: false, reason: "invalid_data" });
    return this.update(actor, id, { isActive }, ctx);
  }

  async remove(actor: CampaignActor, id: string, ctx: Ctx = {}): Promise<CampaignWriteResult> {
    const existing = await prisma.campaign.findUnique({ where: { id }, select: { id: true, name: true } });
    if (!existing) return { ok: false, reason: "not_found" };
    try {
      await prisma.campaign.delete({ where: { id } });
    } catch (err) {
      if (isRecordNotFound(err)) return { ok: false, reason: "not_found" };
      throw err;
    }
    writeAuditLog({
      actorUserId: actor.id,
      actorRole: actor.role,
      action: "campaign.delete",
      entityType: "Campaign",
      entityId: id,
      metadata: { name: existing.name },
      ip: ctx.ip ?? null,
    });
    return { ok: true, id };
  }

  private async exists(id: string) {
    return !!(await prisma.campaign.findUnique({ where: { id }, select: { id: true } }));
  }
}

export const campaignService = new CampaignService();
