import { auth } from "@/auth";
import prisma from "@/lib/db";
import { notFound, redirect } from "next/navigation";
import {
  Calendar,
  Package,
  MapPin,
  CheckCircle2,
  Clock,
  CreditCard,
  ChevronLeft,
  Hash,
} from "lucide-react";
import { Link } from "@/i18n/routing";
import { isGuestOnlinePayEnabled } from "@/lib/guest-payment";
import { getTranslations, setRequestLocale } from "next-intl/server";
import PrintButton from "@/components/guest/PrintButton";
import BookingQrDisplay from "@/components/guest/BookingQrDisplay";
import BookingDetailActions from "@/components/guest/BookingDetailActions";
import { moneyToNumber } from "@/lib/money";
import { getPricingRules } from "@/lib/platform-settings";
import BookingDetailModifySection from "@/components/guest/BookingDetailModifySection";
import BookingStripeReturnSync from "@/components/guest/BookingStripeReturnSync";
import type { Metadata } from "next";
import { dateLocaleForUiLocale } from "@/lib/date-locale";
import { formatTryCurrency } from "@/lib/currency";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string; id: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "Guest" });
  return {
    title: t("bookingDetailMetaTitle"),
    robots: { index: false, follow: false },
  };
}

/**
 * Booking Detail Page - Rezervasyon Detayı (Server Component)
 * Responsive, minimalist and print-friendly design using plain Tailwind.
 */
export default async function BookingDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string; id: string }>;
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { locale, id } = await params;
  const sp = searchParams ? await searchParams : {};
  const paymentIntentRaw = sp["payment_intent"];
  const redirectStatusRaw = sp["redirect_status"];
  const paymentIntentId =
    typeof paymentIntentRaw === "string" ? paymentIntentRaw : undefined;
  const redirectStatus =
    typeof redirectStatusRaw === "string" ? redirectStatusRaw : undefined;

  setRequestLocale(locale);
  const session = await auth();
  const t = await getTranslations("Guest");
  const dateLocale = dateLocaleForUiLocale(locale);

  if (!session?.user?.id) {
    redirect(`/${locale}/login?callbackUrl=/${locale}/bookings/${id}`);
  }

  const [booking, pricingRules] = await Promise.all([
    prisma.booking.findUnique({
      where: { id },
      select: {
        id: true, guestId: true, shopId: true, checkInTime: true, checkOutTime: true,
        totalPrice: true, bagCountS: true, bagCountM: true, bagCountXl: true,
        status: true, qrCodeToken: true, createdAt: true,
        shop: { select: { name: true, pricePerDay: true, address: true, owner: { select: { phone: true } } } },
        seals: { orderBy: { bagIndex: "asc" } },
      },
    }),
    getPricingRules(),
  ]);

  const isAdmin = session?.user?.role === 'ADMIN';
  const isOwner = booking?.guestId === session?.user?.id;

  if (!booking || (!isOwner && !isAdmin)) {
    notFound();
  }

  const isPaidFlow =
    booking.status === "PAID" ||
    booking.status === "CHECKED_IN" ||
    booking.status === "CHECKED_OUT";
  const confirmedAtShop = booking.status === "APPROVED";
  const waitingShop = booking.status === "WAITING_APPROVAL";
  const needsPayment = booking.status === "PENDING";
  const onlinePay = await isGuestOnlinePayEnabled({
    userId: session.user.id,
  });

  const canCancel = ["PENDING", "APPROVED", "PAID"].includes(booking.status);

  return (
    <div className="min-h-screen bg-gray-50 pt-32 pb-20 px-6 font-sans">
      <div className="max-w-md mx-auto flex flex-col gap-6 print-area">
        <Link
          href="/bookings"
          className="inline-flex items-center gap-2 text-xs font-black uppercase tracking-widest text-gray-400 hover:text-orange-600"
        >
          <ChevronLeft size={16} aria-hidden />
          {t("backToBookings")}
        </Link>
        {paymentIntentId ? (
          <BookingStripeReturnSync
            bookingId={id}
            paymentIntentId={paymentIntentId}
            redirectStatus={redirectStatus}
          />
        ) : null}

        {/* Status header */}
        <div className="flex flex-col items-center text-center gap-2 mb-4">
          {isPaidFlow ? (
            <>
              <div className="w-16 h-16 bg-green-100 text-green-600 rounded-full flex items-center justify-center mb-2">
                <CheckCircle2 size={32} />
              </div>
              <h1 className="text-2xl font-black text-gray-900">{t("bookingSuccess")}</h1>
              <p className="text-gray-500 text-sm font-medium px-8">{t("showToPartner")}</p>
            </>
          ) : confirmedAtShop ? (
            <>
              <div className="w-16 h-16 bg-orange-100 text-orange-600 rounded-full flex items-center justify-center mb-2">
                <CheckCircle2 size={32} />
              </div>
              <h1 className="text-2xl font-black text-gray-900">{t("bookingDetailPayAtShopTitle")}</h1>
              <p className="text-gray-500 text-sm font-medium px-8">{t("bookingDetailPayAtShopSub")}</p>
            </>
          ) : waitingShop ? (
            <>
              <div className="w-16 h-16 bg-orange-100 text-orange-600 rounded-full flex items-center justify-center mb-2">
                <Clock size={32} />
              </div>
              <h1 className="text-2xl font-black text-gray-900">{t("bookingDetailWaitingTitle")}</h1>
              <p className="text-gray-500 text-sm font-medium px-8">{t("requestSentSub")}</p>
            </>
          ) : needsPayment ? (
            <>
              <div className="w-16 h-16 bg-amber-100 text-amber-700 rounded-full flex items-center justify-center mb-2">
                <CreditCard size={32} />
              </div>
              <h1 className="text-2xl font-black text-gray-900">{t("bookingDetailPaymentNeededTitle")}</h1>
              <p className="text-gray-500 text-sm font-medium px-8">{t("bookingDetailPaymentNeededSub")}</p>
              {onlinePay ? (
                <Link
                  href={`/bookings/${id}/pay`}
                  className="mt-4 inline-flex items-center justify-center rounded-2xl bg-orange-600 px-8 py-4 text-xs font-black uppercase tracking-widest text-white shadow-lg shadow-orange-200 hover:bg-orange-700"
                >
                  {t("payBookingOpenCta")}
                </Link>
              ) : (
                <p className="mt-4 text-xs font-medium text-gray-500 px-4">
                  {t("bookingDetailPaymentUnavailableNote")}
                </p>
              )}
            </>
          ) : (
            <>
              <div className="w-16 h-16 bg-gray-100 text-gray-600 rounded-full flex items-center justify-center mb-2">
                <Package size={32} />
              </div>
              <h1 className="text-2xl font-black text-gray-900">{t("bookingDetailMetaTitle")}</h1>
            </>
          )}
        </div>

        {/* QR & ID Card */}
        {(isPaidFlow || confirmedAtShop) ? (
        <div className="bg-white rounded-[2.5rem] p-8 shadow-xl shadow-gray-200/50 border border-gray-100 flex flex-col items-center gap-6">
           <BookingQrDisplay token={booking.qrCodeToken} />
           <div className="text-center">
              <p className="text-[10px] font-black text-gray-400 uppercase tracking-[0.3em] mb-1">{t("bookingCodeLabel")}</p>
              <code className="text-xl font-mono font-black text-orange-600 tracking-widest">{booking.id.slice(0, 8).toUpperCase()}</code>
           </div>
        </div>
        ) : (
          <div className="rounded-[2.5rem] border border-gray-100 bg-white p-6 text-center shadow-sm">
            <p className="text-[10px] font-black uppercase tracking-widest text-gray-400">{t("bookingCodeLabel")}</p>
            <code className="mt-2 block text-lg font-mono font-black text-orange-600 tracking-widest">
              {booking.id.slice(0, 8).toUpperCase()}
            </code>
            <p className="mt-3 text-xs font-medium text-gray-500">{t("bookingDetailQrAfterPayment")}</p>
          </div>
        )}

        {/* Details Card */}
        <div className="bg-white rounded-[2.5rem] p-8 shadow-xl shadow-gray-200/50 border border-gray-100 flex flex-col gap-6">
           <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-orange-50 text-orange-600 rounded-2xl flex items-center justify-center">
                 <MapPin size={24} />
              </div>
              <div className="flex-1">
                 <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest leading-none mb-1">{t("depositPointLabel")}</p>
                 <h3 className="font-bold text-gray-900 leading-tight">{booking.shop.name}</h3>
              </div>
           </div>

           <div className="grid grid-cols-2 gap-4">
              <div className="p-4 bg-gray-50 rounded-2xl">
                 <div className="flex items-center gap-2 mb-1">
                    <Calendar size={14} className="text-gray-400" />
                    <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">{t("checkIn")}</span>
                 </div>
                 <p className="text-sm font-bold text-gray-900">{new Date(booking.checkInTime).toLocaleDateString(dateLocale)}</p>
              </div>
              <div className="p-4 bg-gray-50 rounded-2xl">
                 <div className="flex items-center gap-2 mb-1">
                    <Calendar size={14} className="text-gray-400" />
                    <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">{t("checkOut")}</span>
                 </div>
                 <p className="text-sm font-bold text-gray-900">{new Date(booking.checkOutTime).toLocaleDateString(dateLocale)}</p>
              </div>
           </div>

           <div className="flex items-center justify-between p-4 bg-orange-600 text-white rounded-2xl shadow-lg shadow-orange-100">
              <div className="flex items-center gap-3">
                 <Package size={20} />
                 <span className="font-bold">{booking.bagCountS + booking.bagCountM + booking.bagCountXl} {t("bagsUnit")}</span>
              </div>
              <span className="font-black text-lg">
                {formatTryCurrency(moneyToNumber(booking.totalPrice), locale)}
              </span>
           </div>
        </div>

        {booking.seals && booking.seals.length > 0 ? (
          <div className="flex flex-col gap-4 rounded-[2.5rem] border border-orange-100 bg-orange-50/40 p-8 shadow-sm">
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-orange-100 text-orange-700">
                <Hash size={22} aria-hidden />
              </div>
              <div>
                <p className="text-[10px] font-black uppercase tracking-widest text-orange-800/80">
                  {t("guestSealNumbersTitle")}
                </p>
                <p className="text-xs font-medium text-gray-600">{t("guestSealNumbersHint")}</p>
              </div>
            </div>
            <ul className="flex flex-col gap-2">
              {booking.seals.map((s) => (
                <li
                  key={s.id}
                  className="flex items-center justify-between rounded-2xl border border-orange-100/80 bg-white px-4 py-3 text-sm"
                >
                  <span className="font-bold text-gray-800">
                    {t("guestSealRow", {
                      index: s.bagIndex,
                      size: s.bagSize,
                    })}
                  </span>
                  <span className="font-mono text-base font-black text-orange-600 tabular-nums">
                    #{s.sealNumber}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        ) : null}

        <BookingDetailModifySection
          booking={JSON.parse(
            JSON.stringify({
              id: booking.id,
              bagCountS: booking.bagCountS,
              bagCountM: booking.bagCountM,
              bagCountXl: booking.bagCountXl,
              checkInTime: booking.checkInTime,
              checkOutTime: booking.checkOutTime,
              totalPrice: booking.totalPrice,
              status: booking.status,
              shop: {
                name: booking.shop.name,
                pricePerDay: booking.shop.pricePerDay,
              },
            })
          )}
          pricingRules={JSON.parse(JSON.stringify(pricingRules))}
        />

        <BookingDetailActions
          bookingId={booking.id}
          canCancel={canCancel}
          checkInIso={booking.checkInTime.toISOString()}
          checkOutIso={booking.checkOutTime.toISOString()}
          shopName={booking.shop.name}
          shopAddress={booking.shop.address}
          shopPhone={booking.shop.owner?.phone ?? null}
        />

        <PrintButton label={t('downloadReceipt')} />
      </div>
    </div>
  );
}


