import { setRequestLocale, getTranslations } from "next-intl/server";
import { ChevronLeft } from "lucide-react";
import { Link } from "@/i18n/routing";
import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { partnerLeadService } from "@/services/PartnerLeadService";
import AdminPartnerLeadsClient from "@/components/admin/AdminPartnerLeadsClient";

/** `/esnaf` formundan gelen on kayitlar: aranacaklar ustte, arananlar altta. */
export default async function AdminPartnerLeadsPage({
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

  const t = await getTranslations("Admin");
  const tCommon = await getTranslations("Common");
  const leads = await partnerLeadService.list();

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col font-sans">
      <header className="p-6 md:p-10 bg-white border-b border-gray-100 flex items-center gap-4 sticky top-0 z-10">
        <Link
          href="/admin"
          aria-label={tCommon("back")}
          className="p-2 hover:bg-gray-100 rounded-full transition-colors"
        >
          <ChevronLeft size={24} />
        </Link>
        <h1 className="text-2xl md:text-3xl id-display tracking-tight">{t("partnerLeadsTitle")}</h1>
      </header>
      <div className="p-4 md:p-10 max-w-5xl mx-auto w-full">
        <AdminPartnerLeadsClient
          locale={locale}
          leads={leads.map((l) => ({
            id: l.id,
            fullName: l.fullName,
            phone: l.phone,
            shopName: l.shopName,
            address: l.address,
            contacted: l.status === "CONTACTED",
            createdAt: l.createdAt.toISOString(),
          }))}
        />
      </div>
    </div>
  );
}
