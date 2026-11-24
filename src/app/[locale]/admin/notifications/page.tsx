import { setRequestLocale } from "next-intl/server";
import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { notificationLogService } from "@/services/NotificationLogService";
import AdminNotificationsClient from "@/components/admin/AdminNotificationsClient";

/**
 * Bildirim defteri — "bu misafire e-posta gitti mi?" sorusunun cevabı.
 *
 * NEDEN VAR: `NotificationLog` her gönderimi (ve her başarısızlığı) yazıyor ama
 * hiçbir ekran okumuyordu. Misafir "onay e-postası gelmedi" dediğinde
 * yöneticinin elinde yalnızca "gitmiş olmalı" vardı; gerçekten gidip gitmediği,
 * hangi adrese gittiği ve sağlayıcının ne hata döndüğü tabloda duruyordu.
 *
 * `content` VARSAYILAN OLARAK GİZLİ: gövde misafirin adını, rezervasyon kodunu
 * ve adresini taşıyor. Sorunun cevabı için çoğu zaman "gitti mi, hangi adrese,
 * hata ne" yeterli; gövdeyi görmek ayrı bir tıklama olmalı ki kişisel veri
 * kazara ekranda açık durmasın.
 */

const NOTIFICATION_PAGE_SIZE = 150;

export default async function AdminNotificationsPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ status?: string; type?: string; q?: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  const session = await auth();
  if (session?.user?.role !== "ADMIN") {
    redirect(`/${locale}/login`);
  }

  const { status = "ALL", type = "ALL", q = "" } = await searchParams;

  const [page, facets] = await Promise.all([
    notificationLogService.listPage({ status, type, q }, { take: NOTIFICATION_PAGE_SIZE }),
    notificationLogService.facets(),
  ]);
  const logs = page.items;

  return (
    <AdminNotificationsClient
      logs={logs.map((l) => ({
        id: l.id,
        bookingId: l.bookingId,
        type: l.type,
        recipient: l.recipient,
        subject: l.subject,
        content: l.content,
        status: l.status,
        error: l.error,
        createdAt: l.createdAt.toISOString(),
      }))}
      types={facets.types}
      statuses={facets.statuses}
      failedCount={facets.failedCount}
      filter={{ status, type, q }}
    />
  );
}
