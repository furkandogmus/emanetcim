import { setRequestLocale } from "next-intl/server";
import { redirect } from "next/navigation";
import prisma from "@/lib/db";
import { moneyToNumber } from "@/lib/money";
import { EARNING_BOOKING_STATUSES } from "@/lib/platform-split";
import { getEffectiveCommission } from "@/lib/commission";
import { requirePartnerPage } from "@/lib/page-auth";
import { resolvePartnerShops } from "@/lib/partner-shop";
import { partnerEarningsService } from "@/services/PartnerEarningsService";
import PartnerEarningsClient from "@/components/partner/PartnerEarningsClient";

/**
 * Son işlem listesinin ÜST SINIRI.
 *
 * Sayfa eskiden dükkanın TÜM rezervasyonlarını hem sunucuya hem tarayıcıya
 * taşıyordu (bkz. `PartnerEarningsService` başlığındaki ölçüm). Aylık özet zaten
 * tam geçmişi veriyor; buradaki liste "son ne oldu" sorusunu cevaplar, arşiv
 * değil. Tam geçmiş `/partner/bookings`'te sayfalanmış hâlde duruyor.
 */
const RECENT_LIMIT = 25;

export default async function PartnerEarningsPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams?: Promise<{ shop?: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  const actor = await requirePartnerPage(locale, "/partner/earnings");

  const sp = (await searchParams) ?? {};
  // Panelle AYNI dükkan: `?shop=` burada da okunuyor (bkz. `partner-shop.ts`).
  const { shops, activeShop } = await resolvePartnerShops(actor.id, sp.shop);
  if (!activeShop) redirect(`/${locale}/partner`);

  const [commission, shopMeta] = await Promise.all([
    getEffectiveCommission(),
    prisma.shop.findUnique({
      where: { id: activeShop.id },
      select: { rating: true, timezone: true },
    }),
  ]);

  const [summary, recent] = await Promise.all([
    // Toplama VERİTABANINDA; sayfa artık rezervasyon satırı saymıyor.
    partnerEarningsService.getSummary(
      activeShop.id,
      shopMeta?.timezone,
      commission.rate,
    ),
    prisma.booking.findMany({
      where: {
        shopId: activeShop.id,
        status: { in: [...EARNING_BOOKING_STATUSES] },
      },
      select: {
        id: true,
        totalPrice: true,
        createdAt: true,
        guest: { select: { name: true } },
      },
      orderBy: { createdAt: "desc" },
      take: RECENT_LIMIT,
    }),
  ]);

  const conversionRate =
    summary.allBookingCount > 0
      ? Math.round((summary.earningBookingCount / summary.allBookingCount) * 100)
      : 0;

  return (
    <PartnerEarningsClient
      shopName={activeShop.name}
      shops={shops}
      activeShopId={activeShop.id}
      merchantRatio={commission.merchantShareRatio}
      totalGross={summary.totalGross}
      totalNet={summary.totalNet}
      monthly={summary.monthly}
      peakHoursData={summary.peakHours}
      avgStayHours={summary.avgStayHours}
      conversionRate={conversionRate}
      avgRating={shopMeta?.rating ?? 0}
      /* Ayarda duran ama henüz uygulanmayan oran — "ileride %X" demek için. */
      configuredCommissionPct={Math.round(commission.configuredRate * 100)}
      recent={recent.map((b) => ({
        id: b.id,
        totalPrice: moneyToNumber(b.totalPrice),
        createdAt: b.createdAt.toISOString(),
        guestName: b.guest?.name ?? null,
      }))}
      recentLimit={RECENT_LIMIT}
    />
  );
}
