import { setRequestLocale } from "next-intl/server";
import { auth } from "@/auth";
import { redirect } from "next/navigation";
import prisma from "@/lib/db";
import { moneyToNumber } from "@/lib/money";
import AdminDisputesClient from "@/components/admin/AdminDisputesClient";

export default async function AdminDisputesPage({
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

  const disputes = await prisma.dispute.findMany({
    orderBy: { createdAt: "desc" },
    include: {
      booking: {
        select: {
          id: true,
          totalPrice: true,
          checkInTime: true,
          checkOutTime: true,
          status: true,
          guest: { select: { name: true, email: true } },
          shop: { select: { name: true } },
          /*
            MUHUR KANITI (2026-09-01). Fotograf artik cekiliyor
            (`SealService.uploadSealPhoto`) ama uyusmazliga bakan kimse onu
            GOREMIYORDU -- toplanan ve kullanilmayan kanit, toplanmamis
            kanittan yalnizca biraz iyidir. Fotografin var olma sebebi tam
            olarak bu ekran.
          */
          seals: {
            select: { id: true, sealNumber: true, bagIndex: true, bagSize: true, photoUrl: true },
            orderBy: { bagIndex: "asc" },
          },
        },
      },
    },
  });

  const serialized = disputes.map((d) => ({
    ...d,
    createdAt: d.createdAt.toISOString(),
    updatedAt: d.updatedAt.toISOString(),
    booking: {
      ...d.booking,
      totalPrice: moneyToNumber(d.booking.totalPrice),
      seals: d.booking.seals,
      checkInTime: d.booking.checkInTime.toISOString(),
      checkOutTime: d.booking.checkOutTime.toISOString(),
    },
  }));

  return <AdminDisputesClient disputes={serialized} />;
}
