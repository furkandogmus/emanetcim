import { setRequestLocale, getTranslations } from "next-intl/server";
import { ChevronLeft } from "lucide-react";
import { Link } from "@/i18n/routing";
import prisma from "@/lib/db";
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

  const t = await getTranslations("Admin");

  const campaigns = await prisma.campaign.findMany({
    orderBy: { createdAt: "desc" },
    take: 50,
  });

  const activeCount = await prisma.campaign.count({ where: { isActive: true } });

  const activeCampaigns = await prisma.campaign.findMany({
    where: { isActive: true },
    select: { discountPercent: true },
  });
  const maxDiscount = activeCampaigns.reduce(
    (m, c) => Math.max(m, c.discountPercent ?? 0),
    0
  );
  const activeDiscountLabel =
    maxDiscount > 0 ? `${maxDiscount}%` : t("trendNone");

  const topGroup = await prisma.booking.groupBy({
    by: ["shopId"],
    _count: { id: true },
    orderBy: { _count: { id: "desc" } },
    take: 1,
  });
  let topRegionLabel = t("noRegionData");
  if (topGroup[0]) {
    const shop = await prisma.shop.findUnique({
      where: { id: topGroup[0].shopId },
    });
    topRegionLabel =
      shop?.address?.split(",")[0]?.trim() || shop?.name || t("noRegionData");
  }

  const serialized = campaigns.map((c) => ({
    id: c.id,
    name: c.name,
    message: c.message,
    discountPercent: c.discountPercent,
    isActive: c.isActive,
    endsAt: c.endsAt ? c.endsAt.toISOString() : null,
  }));

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col font-sans">
      <header className="p-10 bg-white border-b border-gray-100 flex items-center justify-between sticky top-0 z-10">
        <div className="flex items-center gap-4">
          <Link
            href="/admin"
            className="p-2 hover:bg-gray-100 rounded-full transition-colors"
          >
            <ChevronLeft size={24} />
          </Link>
          <h1 className="text-3xl font-black tracking-tight">{t("createCampaign")}</h1>
        </div>
      </header>

      <main className="p-10 max-w-5xl mx-auto w-full flex flex-col gap-8">
        <AdminCampaignsClient
          initialCampaigns={serialized}
          topRegionLabel={topRegionLabel}
          activeDiscountLabel={activeDiscountLabel}
          activeCampaignCount={activeCount}
        />
      </main>
    </div>
  );
}
