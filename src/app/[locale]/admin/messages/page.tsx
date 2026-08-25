import { setRequestLocale, getTranslations } from "next-intl/server";
import { auth } from "@/auth";
import { Role } from "@prisma/client";
import { redirect } from "@/i18n/routing";
import prisma from "@/lib/db";
import { toContactMessageDTOList } from "@/lib/contact-message-dto";
import AdminMessagesClient from "@/components/admin/AdminMessagesClient";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "Admin" });
  return { title: t("messagesTitle") };
}

export default async function AdminMessagesPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  const session = await auth();
  if (!session?.user || session.user.role !== Role.ADMIN) {
    redirect({ href: "/login", locale });
  }

  const rows = await prisma.contactMessage.findMany({
    include: { replies: { orderBy: { createdAt: "asc" } } },
    orderBy: { createdAt: "desc" },
  });

  return <AdminMessagesClient messages={toContactMessageDTOList(rows)} />;
}
