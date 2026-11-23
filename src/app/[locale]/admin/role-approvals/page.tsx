import { setRequestLocale } from "next-intl/server";
import { adminUserService } from "@/services/AdminUserService";
import { auth } from "@/auth";
import { redirect } from "next/navigation";
import AdminRoleApprovalsClient from "@/components/admin/AdminRoleApprovalsClient";

export default async function AdminRoleApprovalsPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  const session = await auth();
  if (!session?.user || session.user.role !== "ADMIN") {
    redirect(`/${locale}/login`);
  }

  const rows = await adminUserService.listRoleChangeRequests();

  const vm = rows.map((r) => ({
    id: r.id,
    previousRole: r.previousRole,
    requestedRole: r.requestedRole,
    createdAtIso: r.createdAt.toISOString(),
    targetUser: r.targetUser,
    requestedBy: r.requestedBy,
  }));

  return (
    <AdminRoleApprovalsClient
      initialRows={vm}
      currentAdminId={session?.user?.id ?? ""}
    />
  );
}
