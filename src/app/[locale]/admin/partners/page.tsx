import { setRequestLocale } from "next-intl/server";
import { auth } from "@/auth";
import { redirect } from "next/navigation";
import prisma from "@/lib/db";
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

  // Tüm dükkanları çekiyoruz (aktif/pasif fark etmeksizin)
  const shops = await prisma.shop.findMany({
    orderBy: [
      { isActive: "asc" }, // Önce pasifler (onay bekleyenler veya deaktive edilenler)
      { createdAt: "desc" },
    ],
    include: {
      owner: {
        select: {
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
  const serializedShops = shops.map((shop) => ({
    ...shop,
    pricePerDay: Number(shop.pricePerDay),
    rating: shop.rating || 0,
    latitude: shop.latitude || null,
    longitude: shop.longitude || null,
  }));

  return <AdminPartnersClient shops={serializedShops} />;
}
