import { auth } from "@/auth";
import { bookingService } from "@/services/BookingService";
import { notFound, redirect } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import type { Metadata } from "next";
import { paymentService } from "@/services/PaymentService";
import { isStripeGuestCheckoutEnabled } from "@/lib/stripe-checkout";
import BookingStripePayClient from "@/components/guest/BookingStripePayClient";
import { Link } from "@/i18n/routing";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string; id: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "Guest" });
  return {
    title: t("payBookingTitle"),
    robots: { index: false, follow: false },
  };
}

export default async function BookingPayPage({
  params,
}: {
  params: Promise<{ locale: string; id: string }>;
}) {
  const { locale, id } = await params;
  setRequestLocale(locale);

  const session = await auth();
  if (!session?.user?.id) {
    redirect(`/${locale}/login?callbackUrl=/${locale}/bookings/${id}/pay`);
  }

  if (!isStripeGuestCheckoutEnabled()) {
    redirect(`/${locale}/bookings/${id}`);
  }

  const pk = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY?.trim();
  if (!pk) {
    redirect(`/${locale}/bookings/${id}`);
  }

  const booking = await bookingService.getBookingDetails(id);
  if (!booking || booking.guestId !== session.user.id) {
    notFound();
  }

  if (booking.status !== "APPROVED" && booking.status !== "PENDING") {
    redirect(`/${locale}/bookings/${id}`);
  }

  const intent = await paymentService.createStripePaymentIntentForGuestBooking({
    bookingId: id,
    guestId: session.user.id,
  });

  const t = await getTranslations("Guest");

  if (!intent.ok) {
    const code = intent.errorCode;
    const message =
      code === "payments_disabled"
        ? t("payBookingError_payments_disabled")
        : code === "gateway_not_stripe"
          ? t("payBookingError_gateway_not_stripe")
          : code === "stripe_not_configured"
            ? t("payBookingError_stripe_not_configured")
            : code === "booking_not_found"
              ? t("payBookingError_booking_not_found")
              : code === "invalid_booking_status"
                ? t("payBookingError_invalid_booking_status")
                : code === "already_paid"
                  ? t("payBookingError_already_paid")
                  : code === "invalid_amount"
                    ? t("payBookingError_invalid_amount")
                    : code === "stripe_no_client_secret"
                      ? t("payBookingError_stripe_no_client_secret")
                      : code === "stripe_error"
                        ? t("payBookingError_stripe_error")
                        : t("payBookingErrorUnknown");
    return (
      <div className="mx-auto flex min-h-screen max-w-md flex-col gap-6 px-6 pt-28 pb-20">
        <p className="text-sm font-bold text-red-600">{message}</p>
        <Link
          href={`/bookings/${id}`}
          className="text-center text-sm font-black uppercase tracking-widest text-orange-600 hover:underline"
        >
          {t("payBookingBack")}
        </Link>
      </div>
    );
  }

  return (
    <BookingStripePayClient
      bookingId={id}
      clientSecret={intent.clientSecret}
      publishableKey={pk}
    />
  );
}
