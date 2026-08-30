import { setRequestLocale } from "next-intl/server";
import { auth } from "@/auth";
import { redirect } from "next/navigation";
import prisma from "@/lib/db";
import { jobHealthService } from "@/services/JobHealthService";
import { JOB_REGISTRY } from "@/lib/jobs/registry";
import AdminJobsClient from "@/components/admin/AdminJobsClient";

/**
 * Zamanlanmış işler — görünürlük ekranı.
 *
 * NEDEN VAR: `/admin/status` sistem sağlığını bir skora indiriyor ve o skor
 * `SELECT 1` ile veritabanına bakıyor. 2026-07-14'te slot üretimi durduğunda
 * veritabanı sapasağlamdı — yani o ekran kesintiyi GÖSTEREMEZDİ; 37 gün
 * fark edilmedi. Aynı şekilde sekiz işten beşi hiç çalışmıyordu (2026-08-29).
 *
 * SAĞLIK HESABI BURADA YENİDEN YAZILMADI: `JobHealthService` zaten kayıt
 * defteri ile `JobRun` tablosunu karşılaştırıyor ve `/api/health/jobs` de onu
 * kullanıyor. Aynı kuralı ikinci kez yazmak, iki cevabın ayrışması demekti —
 * ekran "iyi", uç "gecikmiş" diyebilirdi.
 *
 * Ekran ayrıca `ifItStops` alanını gösteriyor: bir işin gecikmesinin NE
 * anlama geldiğini bilmeyen bir yönetici, kırmızı bir satırla ne yapacağını
 * da bilmez.
 */
export default async function AdminJobsPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  const session = await auth();
  if (session?.user?.role !== "ADMIN") {
    redirect(`/${locale}/login`);
  }

  const [report, recentRuns] = await Promise.all([
    jobHealthService.check(),
    prisma.jobRun.findMany({
      orderBy: { startedAt: "desc" },
      take: 50,
      select: {
        id: true,
        job: true,
        status: true,
        startedAt: true,
        finishedAt: true,
        durationMs: true,
        detail: true,
      },
    }),
  ]);

  /** Kayıt defterindeki açıklamalar — sağlık raporunda taşınmıyor. */
  const explanations = Object.fromEntries(
    JOB_REGISTRY.map((j) => [j.name, { ifItStops: j.ifItStops, method: j.method }]),
  );

  return (
    <AdminJobsClient
      report={report}
      explanations={explanations}
      runs={recentRuns.map((r) => ({
        id: r.id,
        job: r.job,
        status: r.status,
        startedAt: r.startedAt.toISOString(),
        finishedAt: r.finishedAt?.toISOString() ?? null,
        durationMs: r.durationMs,
        detail: r.detail === null ? null : JSON.stringify(r.detail),
      }))}
    />
  );
}
