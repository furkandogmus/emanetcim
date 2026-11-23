import { setRequestLocale } from "next-intl/server";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import AdminAccountDeletionsClient from "@/components/admin/AdminAccountDeletionsClient";
import { accountPrivacyService } from "@/services/AccountPrivacyService";

export default async function AdminAccountDeletionsPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);

  const session = await auth();
  if (session?.user?.role !== "ADMIN") redirect(`/${locale}/login`);

  const rows = await accountPrivacyService.listDeletionRequests();
  return (
    <AdminAccountDeletionsClient
      currentAdminId={session.user.id}
      rows={rows.map((r) => ({
        id: r.id,
        userId: r.userId,
        role: r.role,
        status: r.status,
        note: r.note,
        requestedAtIso: r.requestedAt.toISOString(),
        dueAtIso: r.dueAt.toISOString(),
        name: r.user.name,
        email: r.user.email,
        activeBookings: r.blockers.activeBookings,
        pendingPayouts: r.blockers.pendingPayouts,
      }))}
    />
  );
}
