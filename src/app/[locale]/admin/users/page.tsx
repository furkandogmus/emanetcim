import { setRequestLocale, getTranslations } from "next-intl/server";
import prisma from "@/lib/db";
import AdminUsersClient from "@/components/admin/AdminUsersClient";

export default async function AdminUsersPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  const t = await getTranslations("Admin");

  // Tüm kullanıcıları çekiyoruz
  const users = await prisma.user.findMany({
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
  });

  return <AdminUsersClient users={users} />;
}
