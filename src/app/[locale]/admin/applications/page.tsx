import { setRequestLocale } from "next-intl/server";
import { auth } from "@/auth";
import { redirect } from "next/navigation";
import prisma from "@/lib/db";
import { PENDING_APPLICATION_WHERE } from "@/lib/pending-application";
import AdminApplicationsClient from "@/components/admin/AdminApplicationsClient";

export default async function AdminApplicationsPage({
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

  // Onay bekleyen dükkanları ve sahiplerini çekiyoruz
  const applications = await prisma.shop.findMany({
    where: PENDING_APPLICATION_WHERE,
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
