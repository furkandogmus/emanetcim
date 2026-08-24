import { setRequestLocale, getTranslations } from "next-intl/server";
import { auth } from "@/auth";
import { redirect, notFound } from "next/navigation";
import prisma from "@/lib/db";
import DisputeForm from "@/components/guest/DisputeForm";
import { Link } from "@/i18n/routing";
import { ChevronLeft } from "lucide-react";
import type { Metadata } from "next";

/**
 * Ham `Dispute.status` degeri ("OPEN", "IN_REVIEW"...) misafire dogrudan
 * gosteriliyordu -- teknik/ingilizce bir enum degeri. Durum + renk eslemesi
 * burada, tek yerde.
 */
function disputeStatusView(status: string): { labelKey: string; stateClass: string } {
  switch (status) {
    case "RESOLVED":
      return { labelKey: "statusResolved", stateClass: "ui-state-success" };
    case "CLOSED":
      return { labelKey: "statusClosed", stateClass: "ui-state-empty" };
    case "IN_REVIEW":
      return { labelKey: "statusInReview", stateClass: "ui-state-empty" };
    default:
      return { labelKey: "statusOpen", stateClass: "ui-state-empty" };
  }
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string; id: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "Dispute" });
  return {
    title: t("metaTitle"),
    robots: { index: false, follow: false },
  };
}

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
    const { labelKey, stateClass } = disputeStatusView(booking.dispute.status);
    return (
      <div className="min-h-screen bg-gray-50 p-6 flex items-center justify-center">
        <div className="ui-card max-w-lg w-full mx-auto rounded-3xl p-8">
          <Link
            href={`/bookings/${booking.id}`}
            className="ui-kicker inline-flex items-center gap-1.5 text-gray-400 hover:text-orange-600 transition-colors"
          >
            <ChevronLeft size={14} />
            {t("backToBooking")}
          </Link>
          <h1 className="ui-heading-md mt-4">{t("statusTitle")}</h1>
          <p className="ui-body-sm mt-1">{booking.shop?.name ?? ""}</p>

          <span className="ui-kicker block mt-6 mb-2">{t("statusLabel")}</span>
          <span className={`ui-state ${stateClass} inline-block`}>{t(labelKey)}</span>

          <span className="ui-kicker block mt-6 mb-2">{t("descriptionLabel")}</span>
          <p className="ui-body-sm">{booking.dispute.description}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <DisputeForm bookingId={booking.id} shopName={booking.shop?.name ?? ""} />
    </div>
  );
}
