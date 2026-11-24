import { setRequestLocale } from "next-intl/server";
import { auth } from "@/auth";
import { redirect } from "next/navigation";
import prisma from "@/lib/db";
import { auditLogService } from "@/services/AuditLogService";
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
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function AdminAuditLogPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ action?: string; entityType?: string; q?: string; userId?: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  const session = await auth();
  if (session?.user?.role !== "ADMIN") {
    redirect(`/${locale}/login`);
  }

  const { action = "ALL", entityType = "ALL", q = "", userId: rawUserId = "" } = await searchParams;
  // Kisiye gore suzgec (kullanici detayindan gelen bag): yaptigi ve ona yapilan islemler.
  const userId = UUID_RE.test(rawUserId) ? rawUserId : null;

  // Sorgu ve aktor cozumu `AuditLogService`te: mobil admin ekrani da oradan okur.
  const [page, options] = await Promise.all([
    auditLogService.listPage(
      {
        action: action !== "ALL" ? action : null,
        entityType: entityType !== "ALL" ? entityType : null,
        q,
        userId,
      },
      { take: AUDIT_PAGE_SIZE },
    ),
    auditLogService.filterOptions(),
  ]);
  const person = userId
    ? await prisma.user.findUnique({ where: { id: userId }, select: { name: true, email: true, phone: true } })
    : null;

  return (
    <AdminAuditLogClient
      entries={page.items.map((e) => ({
        id: e.id,
        action: e.action,
        actorRole: e.actorRole,
        actorUserId: e.actorUserId,
        actorLabel: e.actorLabel,
        entityType: e.entityType,
        entityId: e.entityId,
        ip: e.ip,
        metadata: e.metadata === null ? null : JSON.stringify(e.metadata),
        createdAt: e.createdAt.toISOString(),
      }))}
      actions={options.actions}
      entityTypes={options.entityTypes}
      filter={{ action, entityType, q, userId: userId ?? "" }}
      personLabel={person ? (person.name ?? person.email ?? person.phone ?? userId) : userId}
    />
  );
}
