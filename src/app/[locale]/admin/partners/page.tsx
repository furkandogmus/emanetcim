import { setRequestLocale } from "next-intl/server";
import prisma from "@/lib/db";
import AdminPartnersClient from "@/components/admin/AdminPartnersClient";

export default async function AdminPartnersPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

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

  return <AdminPartnersClient shops={shops} />;
}
