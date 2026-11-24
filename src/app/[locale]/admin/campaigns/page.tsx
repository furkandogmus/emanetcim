import { setRequestLocale, getTranslations } from "next-intl/server";
import { ChevronLeft } from "lucide-react";
import { Link } from "@/i18n/routing";
import { auth } from "@/auth";
import { redirect } from "next/navigation";
import prisma from "@/lib/db";
import { moneyToNumber } from "@/lib/money";
import { campaignService } from "@/services/CampaignService";
import AdminCampaignsClient from "@/components/admin/AdminCampaignsClient";

/**
 * Admin Campaigns Page - Kampanya ve İndirim Yönetimi
 */
export default async function AdminCampaignsPage({
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

  const [campaigns, { activeCount, maxActiveDiscount: maxDiscount }] = await Promise.all([
    campaignService.listForAdmin(),
    campaignService.activeSummary(),
  ]);
  const activeDiscountLabel =
    maxDiscount > 0 ? `${maxDiscount}%` : t("trendNone");

  const topShop = await prisma.shop.findFirst({
    where: { isActive: true, bookings: { some: {} } },
    orderBy: { bookings: { _count: "desc" } },
    select: { name: true, address: true },
  });
  const topRegionLabel = topShop
    ? topShop.address?.split(",")[0]?.trim() || topShop.name
    : t("noRegionData");

  const serialized = campaigns.map((c) => ({
    id: c.id,
    name: c.name,
    message: c.message,
    discountPercent:
      c.discountPercent != null ? moneyToNumber(c.discountPercent) : null,
    isActive: c.isActive,
    endsAt: c.endsAt ? c.endsAt.toISOString() : null,
  }));

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col font-sans">
      <header className="p-10 bg-white border-b border-gray-100 flex items-center justify-between sticky top-0 z-10">
        <div className="flex items-center gap-4">
          <Link
            href="/admin"
            aria-label={tCommon("back")}
            className="p-2 hover:bg-gray-100 rounded-full transition-colors"
          >
            <ChevronLeft size={24} />
          </Link>
          <h1 className="text-3xl font-black tracking-tight">{t("createCampaign")}</h1>
        </div>
      </header>

      <div className="p-10 max-w-5xl mx-auto w-full flex flex-col gap-8">
        <AdminCampaignsClient
          initialCampaigns={serialized}
          topRegionLabel={topRegionLabel}
          activeDiscountLabel={activeDiscountLabel}
          activeCampaignCount={activeCount}
        />
      </div>
    </div>
  );
}
