import type { Prisma } from "@prisma/client";
import prisma from "@/lib/db";
import { cursorArgs, toPage } from "@/lib/cursor-page";

/**
 * Denetim kaydi -- okuma yuzeyi (web `/admin/audit-log` sayfasi + mobil admin).
 *
 * Sorgu 2026-11-23'e kadar web sayfasinin ICINDEYDI; mobil ekran ayni filtreleri
 * ve ayni "aktor kim" cozumunu kullansin diye buraya tasindi. Filtreler SUNUCUDA
 * uygulanir: tablo her admin isleminde bir satir buyur, tarayicida filtrelemek
 * surdurulebilir degil.
 */

export type AuditLogFilter = {
  /** Tam eylem adi (web secim kutusu). */
  action?: string | null;
  /** Eylem oneki, ornegin `user.` (mobil cipler). */
  actionPrefix?: string | null;
  entityType?: string | null;
  /** Aktor id'si, varlik id'si ya da IP icinde serbest arama (web). */
  q?: string | null;
  /** Bu kullanicinin yaptigi YA DA ona yapilan islemler (mobil kullanici detayi). */
  userId?: string | null;
};

function whereOf(f: AuditLogFilter): Prisma.AuditLogWhereInput | undefined {
  const and: Prisma.AuditLogWhereInput[] = [];
  if (f.action) and.push({ action: f.action });
  if (f.actionPrefix) and.push({ action: { startsWith: f.actionPrefix } });
  if (f.entityType) and.push({ entityType: f.entityType });
  const q = f.q?.trim();
  if (q) {
    const needle = { contains: q, mode: "insensitive" as const };
    and.push({ OR: [{ actorUserId: needle }, { entityId: needle }, { ip: needle }] });
  }
  if (f.userId) and.push({ OR: [{ actorUserId: f.userId }, { entityId: f.userId }] });
  return and.length ? { AND: and } : undefined;
}

export class AuditLogService {
  /** Yeniden eskiye sayfa; her satir aktorun adiyla (`actorLabel`) doner. */
  async listPage(filter: AuditLogFilter, opts: { cursor?: string | null; take?: number } = {}) {
    const take = Math.min(Math.max(1, opts.take ?? 50), 200);
    const rows = await prisma.auditLog.findMany({
      where: whereOf(filter),
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      ...cursorArgs(opts.cursor ?? null, take),
    });
    const page = toPage(rows, take);

    /*
      Aktorlari TEK sorguda cekiyoruz; satir basina sorgu (N+1) 200 satirda 200
      sorgu demekti.
    */
    const actorIds = [...new Set(page.items.map((e) => e.actorUserId).filter((id): id is string => !!id))];
    const actors = actorIds.length
      ? await prisma.user.findMany({ where: { id: { in: actorIds } }, select: { id: true, name: true, email: true } })
      : [];
    const byId = new Map(actors.map((a) => [a.id, a]));
    return {
      items: page.items.map((e) => {
        const a = e.actorUserId ? byId.get(e.actorUserId) : undefined;
        return { ...e, actorLabel: a ? (a.name ?? a.email ?? null) : null };
      }),
      nextCursor: page.nextCursor,
    };
  }

  /*
    Filtre secenekleri VERIDEN turer: kod tarafinda sabit bir liste tutmak, yeni
    bir denetim eylemi eklendiginde sessizce eskir.
  */
  async filterOptions() {
    const [actionGroups, entityGroups] = await Promise.all([
      prisma.auditLog.groupBy({ by: ["action"], _count: true, orderBy: { action: "asc" } }),
      prisma.auditLog.groupBy({ by: ["entityType"], _count: true, orderBy: { entityType: "asc" } }),
    ]);
    const actions = actionGroups.map((g) => g.action);
    return {
      actions,
      entityTypes: entityGroups.map((g) => g.entityType).filter((v): v is string => v !== null),
      /** `user.role_update` -> `user.`: mobil ciplerin listesi. */
      actionPrefixes: [...new Set(actions.map((a) => (a.includes(".") ? `${a.split(".")[0]}.` : a)))],
    };
  }
}

export const auditLogService = new AuditLogService();
