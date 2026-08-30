import { setRequestLocale } from "next-intl/server";
import { auth } from "@/auth";
import { redirect } from "next/navigation";
import prisma from "@/lib/db";
import { moneyToNumber } from "@/lib/money";
import AdminCouponsClient from "@/components/admin/AdminCouponsClient";

/**
 * Kupon yönetimi.
 *
 * NEDEN VAR: `CouponService` ve `booking/lifecycle` kuponu uyguluyordu ama
 * kupon ÜRETECEK hiçbir ekran yoktu — kupon ancak veritabanına elle satır
 * atılarak doğabiliyordu. Yani çalışan bir özelliğin girişi yoktu.
 *
 * (Kampanya ekranı ayrı bir şeydir: o pazarlama mesajı ve genel bir indirim
 * yüzdesi taşır, kupon ise kodla, kotayla ve son kullanma tarihiyle çalışır.)
 */
export default async function AdminCouponsPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  const session = await auth();
  if (session?.user?.role !== "ADMIN") {
    redirect(`/${locale}/login`);
  }

  const coupons = await prisma.coupon.findMany({
    orderBy: [{ isActive: "desc" }, { createdAt: "desc" }],
  });

  return (
    <AdminCouponsClient
      coupons={coupons.map((c) => ({
        id: c.id,
        code: c.code,
        discount: moneyToNumber(c.discount),
        isPercent: c.isPercent,
        minPrice: c.minPrice === null ? null : moneyToNumber(c.minPrice),
        maxUses: c.maxUses,
        usedCount: c.usedCount,
        expiresAt: c.expiresAt?.toISOString() ?? null,
        isActive: c.isActive,
        createdAt: c.createdAt.toISOString(),
      }))}
    />
  );
}
