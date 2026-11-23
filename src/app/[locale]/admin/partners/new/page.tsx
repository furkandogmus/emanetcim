import { setRequestLocale } from "next-intl/server";
import { auth } from "@/auth";
import { redirect } from "next/navigation";
import prisma from "@/lib/db";
import { leadConversionDraft } from "@/services/PartnerLeadService";
import AdminPartnerCreateClient from "@/components/admin/AdminPartnerCreateClient";

export default async function AdminPartnerCreatePage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ fromUser?: string; fromLead?: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  const session = await auth();
  if (!session?.user || session.user.role !== "ADMIN") {
    redirect(`/${locale}/login`);
  }

  // `?fromUser=` ile gelindiyse form misafir hesabını esnafa çevirir; yeni hesap açmaz.
  const { fromUser, fromLead } = await searchParams;

  // `?fromLead=` ile gelindiyse form esnaf on kaydindan dolar ve onu cevirir.
  const lead = fromLead ? await prisma.partnerLead.findUnique({ where: { id: fromLead } }) : null;
  if (lead) {
    return (
      <AdminPartnerCreateClient
        fromLead={{
          id: lead.id,
          draft: leadConversionDraft(lead),
          convertedShopId: lead.convertedAt ? lead.convertedShopId ?? "" : null,
        }}
      />
    );
  }

  const guest = fromUser
    ? await prisma.user.findFirst({
        where: { id: fromUser, role: "GUEST" },
        select: { id: true, name: true, email: true, phone: true },
      })
    : null;

  return <AdminPartnerCreateClient convertFrom={guest} />;
}
