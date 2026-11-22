import { setRequestLocale } from "next-intl/server";
import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { disputeService } from "@/services/DisputeService";
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

  const disputes = await disputeService.listForAdmin();

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
