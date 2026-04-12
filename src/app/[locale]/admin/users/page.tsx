import { setRequestLocale } from "next-intl/server";
import prisma from "@/lib/db";
import AdminUsersClient from "@/components/admin/AdminUsersClient";
import { auth } from "@/auth";

export default async function AdminUsersPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  const session = await auth();

  // Tüm kullanıcıları çekiyoruz
  const [users, pendingRoleApprovalCount] = await Promise.all([
    prisma.user.findMany({
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        isBanned: true,
        lastIp: true,
        emailVerified: true,
        createdAt: true,
      },
    }),
    prisma.adminRoleChangeRequest.count(),
  ]);

  return (
    <AdminUsersClient
      users={users}
      currentAdminId={session?.user?.id ?? ""}
      pendingRoleApprovalCount={pendingRoleApprovalCount}
    />
  );
}
