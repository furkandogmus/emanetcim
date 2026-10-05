import { setRequestLocale } from "next-intl/server";
import { auth } from "@/auth";
import { redirect } from "next/navigation";
import prisma from "@/lib/db";
import AdminPartnerCreateClient from "@/components/admin/AdminPartnerCreateClient";

export default async function AdminPartnerCreatePage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ fromUser?: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  const session = await auth();
  if (!session?.user || session.user.role !== "ADMIN") {
    redirect(`/${locale}/login`);
  }

  // `?fromUser=` ile gelindiyse form misafir hesabını esnafa çevirir; yeni hesap açmaz.
  const { fromUser } = await searchParams;
  const guest = fromUser
    ? await prisma.user.findFirst({
        where: { id: fromUser, role: "GUEST" },
        select: { id: true, name: true, email: true, phone: true },
      })
    : null;

  return <AdminPartnerCreateClient convertFrom={guest} />;
}
