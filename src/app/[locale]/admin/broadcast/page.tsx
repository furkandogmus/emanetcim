import { setRequestLocale } from "next-intl/server";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import AdminBroadcastClient from "@/components/admin/AdminBroadcastClient";
import { listBroadcasts } from "@/services/BroadcastService";

/** Duyuru gonder: mobil `admin/broadcast` ekraniyla ayni servis ve sinirlar. */
export default async function AdminBroadcastPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const session = await auth();
  if (session?.user?.role !== "ADMIN") redirect(`/${locale}/login`);

  const rows = await listBroadcasts(20);
  return (
    <AdminBroadcastClient
      history={rows.map((b) => ({
        id: b.id,
        audience: b.audience,
        titleTr: b.titleTr,
        bodyTr: b.bodyTr,
        status: b.status,
        targetedDevices: b.targetedDevices,
        sent: b.sent,
        failed: b.failed,
        createdAtIso: b.createdAt.toISOString(),
        createdByName: b.createdByName,
      }))}
    />
  );
}
