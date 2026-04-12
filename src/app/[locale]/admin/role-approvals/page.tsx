import { setRequestLocale } from "next-intl/server";
import prisma from "@/lib/db";
import { auth } from "@/auth";
import AdminRoleApprovalsClient from "@/components/admin/AdminRoleApprovalsClient";

export default async function AdminRoleApprovalsPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  const session = await auth();

  const rows = await prisma.adminRoleChangeRequest.findMany({
    orderBy: { createdAt: "asc" },
    include: {
      targetUser: {
        select: { id: true, name: true, email: true, role: true },
      },
      requestedBy: {
        select: { id: true, name: true, email: true },
      },
    },
  });

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
