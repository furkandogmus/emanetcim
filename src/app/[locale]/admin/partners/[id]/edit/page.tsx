import { setRequestLocale } from "next-intl/server";
import { auth } from "@/auth";
import { redirect, notFound } from "next/navigation";
import prisma from "@/lib/db";
import AdminPartnerEditClient from "@/components/admin/AdminPartnerEditClient";

export default async function AdminPartnerEditPage({
  params,
}: {
  params: Promise<{ locale: string; id: string }>;
}) {
  const { locale, id } = await params;
  setRequestLocale(locale);

  const session = await auth();
  if (!session?.user || session.user.role !== "ADMIN") {
    redirect(`/${locale}/login`);
  }

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

  // Flight / Client: Prisma Decimal, Date vb. düz JSON’a indir (üretimde RSC serileştirme hatası önlenir)
  const serializedShop = JSON.parse(
    JSON.stringify({
      ...shop,
      pricePerDay: Number(shop.pricePerDay),
      rating: shop.rating ?? 0,
      latitude: shop.latitude ?? null,
      longitude: shop.longitude ?? null,
    })
  ) as typeof shop & {
    pricePerDay: number;
    rating: number;
    latitude: number | null;
    longitude: number | null;
  };

  return <AdminPartnerEditClient shop={serializedShop} />;
}
