import { setRequestLocale } from "next-intl/server";
import prisma from "@/lib/db";
import AdminApplicationsClient from "@/components/admin/AdminApplicationsClient";

export default async function AdminApplicationsPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  // Onay bekleyen dükkanları ve sahiplerini çekiyoruz
  const applications = await prisma.shop.findMany({
    where: { isActive: false },
    orderBy: { createdAt: "desc" },
    include: {
      owner: {
        select: {
          name: true,
          email: true,
          phone: true,
        },
      },
    },
  });

  return <AdminApplicationsClient applications={applications} />;
}
