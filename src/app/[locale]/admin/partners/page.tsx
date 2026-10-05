import { setRequestLocale } from "next-intl/server";
import { auth } from "@/auth";
import { redirect } from "next/navigation";
import prisma from "@/lib/db";
import { hoursForDate } from "@/lib/shop-schedule";
import { todayInZone } from "@/lib/stay-days";
import { loadScheduleParts } from "@/services/ShopScheduleService";
import AdminPartnersClient from "@/components/admin/AdminPartnersClient";

export default async function AdminPartnersPage({
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

  // Son 200 dükkan (admin pagination için yeterli — bkz. admin/users/page.tsx
  // aynı desen; 2026-09-10'da bulundu: bu ekran tek istisna olarak sınırsızdı).
  const shops = await prisma.shop.findMany({
    orderBy: [
      { isActive: "asc" }, // Önce pasifler (onay bekleyenler veya deaktive edilenler)
      { createdAt: "desc" },
    ],
    take: 200,
    include: {
      owner: {
        select: {
          id: true,
          name: true,
          email: true,
          phone: true,
        },
      },
      _count: {
        select: {
          bookings: true,
          reviews: true,
        },
      },
    },
  });

  // Decimal alanları number’a çeviriyoruz (build hatası ve serileştirme için)
  const parts = await loadScheduleParts(
    shops.map((s) => s.id),
    new Date().toISOString().slice(0, 10),
  );
  const serializedShops = shops.map((shop) => {
    const tz = shop.timezone || "Europe/Istanbul";
    const hours = hoursForDate(
      { open247: shop.open247, openingTime: shop.openingTime, closingTime: shop.closingTime, timeZone: tz, ...parts.get(shop.id) },
      todayInZone(tz),
    );
    const hoursToday = !hours
      ? ({ kind: "closed" } as const)
      : shop.open247
        ? ({ kind: "open247" } as const)
        : ({ kind: "range", text: `${hours.open} – ${hours.close}` } as const);
    return { ...shop, hoursToday };
  }).map((shop) => ({
    ...shop,
    pricePerDay: Number(shop.pricePerDay),
    rating: shop.rating || 0,
    latitude: shop.latitude || null,
    longitude: shop.longitude || null,
  }));

  return <AdminPartnersClient shops={serializedShops} />;
}
