import { setRequestLocale, getTranslations } from "next-intl/server";
import { auth } from "@/auth";
import { redirect, notFound } from "next/navigation";
import prisma from "@/lib/db";
import DisputeForm from "@/components/guest/DisputeForm";

export default async function DisputePage({
  params,
}: {
  params: Promise<{ locale: string; id: string }>;
}) {
  const { locale, id } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("Dispute");

  const session = await auth();
  if (!session?.user?.id) {
    redirect(`/${locale}/login`);
  }

  const booking = await prisma.booking.findUnique({
    where: { id },
    include: { shop: true, dispute: true },
  });

  if (!booking || booking.guestId !== session.user.id) {
    notFound();
  }

  if (booking.dispute) {
    return (
      <div className="min-h-screen bg-gray-50 p-6 max-w-lg mx-auto">
        <h1 className="text-xl font-black">{t("statusTitle")}</h1>
        <p className="mt-4 text-sm text-gray-600">{t("statusLabel")}: {booking.dispute.status}</p>
        <p className="mt-2 text-sm">{booking.dispute.description}</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <DisputeForm bookingId={booking.id} shopName={booking.shop?.name ?? ""} />
    </div>
  );
}
