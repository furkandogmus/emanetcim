import { setRequestLocale } from "next-intl/server";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { parseCursor } from "@/lib/cursor-page";
import AdminReviewsClient from "@/components/admin/AdminReviewsClient";
import { AUTO_HIDE_REASON, parseAdminReviewFilter, reviewService } from "@/services/ReviewService";

/** Yorum moderasyonu: bildirilenler once (App Review 1.2). Mobil `/admin/reviews` ile ayni sorgu. */
export default async function AdminReviewsPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ filter?: string; cursor?: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const session = await auth();
  if (session?.user?.role !== "ADMIN") redirect(`/${locale}/login`);

  const sp = await searchParams;
  const filter = parseAdminReviewFilter(sp.filter ?? "reported");
  const cursor = parseCursor(sp.cursor);
  const page = await reviewService.listForAdmin({ filter, cursor, take: 50 });
  return (
    <AdminReviewsClient
      filter={filter}
      total={page.total}
      nextCursor={page.nextCursor}
      isFirstPage={cursor === null}
      rows={page.items.map((r) => ({
        id: r.id,
        rating: r.rating,
        comment: r.comment,
        createdAtIso: r.createdAt.toISOString(),
        guestName: r.guest.name?.trim() ?? "",
        shop: { id: r.shop.id, name: r.shop.name },
        hidden: r.hiddenAt !== null,
        autoHidden: r.hiddenReason === AUTO_HIDE_REASON,
        hiddenReason: r.hiddenReason === AUTO_HIDE_REASON ? null : r.hiddenReason,
        openReportCount: r.openReportCount,
        reports: r.reports.map((x) => ({ reason: x.reason, note: x.note })),
      }))}
    />
  );
}
