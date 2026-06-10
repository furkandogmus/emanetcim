import { setRequestLocale } from "next-intl/server";
import prisma from "@/lib/db";
import AdminUsersClient from "@/components/admin/AdminUsersClient";
import { auth } from "@/auth";
import { redirect } from "next/navigation";

export default async function AdminUsersPage({
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

  // Son 200 kullanıcı (admin pagination için yeterli)
  const [users, pendingRoleApprovalCount] = await Promise.all([
    prisma.user.findMany({
      orderBy: { createdAt: "desc" },
      take: 200,
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
