import { setRequestLocale } from "next-intl/server";
import { auth } from "@/auth";
import { redirect } from "next/navigation";
import prisma from "@/lib/db";
import type { Prisma } from "@prisma/client";
import AdminAuditLogClient from "@/components/admin/AdminAuditLogClient";

/**
 * Denetim kaydı — okuma yüzeyi.
 *
 * NEDEN VAR: `src/lib/audit-log.ts` altı yerden yazıyor (rol değişikliği,
 * feature flag, esnaf şifre sıfırlama, hesap silme, dükkan onayı, gizlilik
 * işlemleri) ama 2026-08-30'a kadar HİÇBİR ekran okumuyordu. Yazılıp
 * okunmayan denetim kaydı denetim kaydı değildir: "bu ayarı kim değiştirdi"
 * sorusunun cevabı tabloda duruyordu ve kimse ona bakamıyordu.
 *
 * Filtreler SUNUCUDA uygulanır — tablo büyüdükçe (her admin işlemi bir satır)
 * tarayıcıya indirip filtrelemek sürdürülebilir değil.
 */

const AUDIT_PAGE_SIZE = 200;

export default async function AdminAuditLogPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ action?: string; entityType?: string; q?: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  const session = await auth();
  if (session?.user?.role !== "ADMIN") {
    redirect(`/${locale}/login`);
  }

  const { action = "ALL", entityType = "ALL", q = "" } = await searchParams;

  const filters: Prisma.AuditLogWhereInput[] = [];
  if (action !== "ALL") filters.push({ action });
  if (entityType !== "ALL") filters.push({ entityType });
  if (q.trim()) {
    const needle = { contains: q.trim(), mode: "insensitive" as const };
    filters.push({
      OR: [{ actorUserId: needle }, { entityId: needle }, { ip: needle }],
    });
  }

  const [entries, actionGroups, entityGroups] = await Promise.all([
    prisma.auditLog.findMany({
      where: filters.length ? { AND: filters } : undefined,
      orderBy: { createdAt: "desc" },
      take: AUDIT_PAGE_SIZE,
    }),
    // Filtre secenekleri VERIDEN turer: kod tarafinda sabit bir liste tutmak,
    // yeni bir denetim eylemi eklendiginde sessizce eskir.
    prisma.auditLog.groupBy({ by: ["action"], _count: true, orderBy: { action: "asc" } }),
    prisma.auditLog.groupBy({
      by: ["entityType"],
      _count: true,
      orderBy: { entityType: "asc" },
    }),
  ]);

  /*
    Aktorun kim oldugunu gostermek icin kullanicilari TEK sorguda cekiyoruz;
    satir basina sorgu (N+1) 200 satirda 200 sorgu demekti.
  */
  const actorIds = [...new Set(entries.map((e) => e.actorUserId).filter((id): id is string => !!id))];
  const actors = actorIds.length
    ? await prisma.user.findMany({
        where: { id: { in: actorIds } },
        select: { id: true, name: true, email: true },
      })
    : [];
  const actorById = new Map(actors.map((a) => [a.id, a]));

  return (
    <AdminAuditLogClient
      entries={entries.map((e) => ({
        id: e.id,
        action: e.action,
        actorRole: e.actorRole,
        actorUserId: e.actorUserId,
        actorLabel: e.actorUserId
          ? (actorById.get(e.actorUserId)?.name ?? actorById.get(e.actorUserId)?.email ?? null)
          : null,
        entityType: e.entityType,
        entityId: e.entityId,
        ip: e.ip,
        metadata: e.metadata === null ? null : JSON.stringify(e.metadata),
        createdAt: e.createdAt.toISOString(),
      }))}
      actions={actionGroups.map((g) => g.action)}
      entityTypes={entityGroups
        .map((g) => g.entityType)
        .filter((v): v is string => v !== null)}
      filter={{ action, entityType, q }}
    />
  );
}
