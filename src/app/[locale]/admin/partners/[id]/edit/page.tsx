import { setRequestLocale } from "next-intl/server";
import prisma from "@/lib/db";
import { notFound } from "next/navigation";
import AdminPartnerEditClient from "@/components/admin/AdminPartnerEditClient";

export default async function AdminPartnerEditPage({
  params,
}: {
  params: Promise<{ locale: string; id: string }>;
}) {
  const { locale, id } = await params;
  setRequestLocale(locale);

  // Dükkan detaylarını ve tüm yorumlarını çekiyoruz
  const shop = await prisma.shop.findUnique({
    where: { id },
    include: {
      owner: {
        select: {
          name: true,
          email: true,
          phone: true,
        },
      },
      reviews: {
        orderBy: { createdAt: "desc" },
        include: {
          guest: {
            select: {
              name: true,
            },
          },
        },
      },
      _count: {
        select: {
          bookings: true,
        },
      },
    },
  });

  if (!shop) {
    notFound();
  }

  return <AdminPartnerEditClient shop={shop} />;
}
