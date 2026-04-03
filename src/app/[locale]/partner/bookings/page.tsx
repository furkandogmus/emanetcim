import { setRequestLocale, getTranslations } from "next-intl/server";
import { ChevronLeft, Package, Clock, CheckCircle2, Phone } from "lucide-react";
import { Link } from "@/i18n/routing";
import { auth } from "@/auth";
import prisma from "@/lib/db";

/**
 * Partner Bookings / History Page - Esnaf Takvimi
 */
export default async function PartnerBookingsPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  const t = await getTranslations("Partner");
  const tGuest = await getTranslations("Guest");

  const session = await auth();
  const userId = session?.user?.id;

  if (!userId) {
    const callback = encodeURIComponent(`/${locale}/partner/bookings`);
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-6 text-center">
        <div>
          <h2 className="text-xl font-bold text-gray-900 mb-2">{t("accessDenied")}</h2>
          <p className="text-gray-500 mb-6">{t("loginRequiredPartner")}</p>
          <Link
            href={`/login?callbackUrl=${callback}`}
            className="inline-flex bg-orange-600 text-white px-8 py-4 rounded-2xl text-sm font-black uppercase tracking-widest hover:bg-orange-700 transition-colors"
          >
            {t("signIn")}
          </Link>
        </div>
      </div>
    );
  }

  const dbBookings = await prisma.booking.findMany({
    where: { shop: { ownerId: userId } },
    include: { guest: true },
    orderBy: { checkInTime: "asc" },
  });

  const timeLocale = locale === "tr" ? "tr-TR" : "en-US";

  const tasks = dbBookings.map((b) => {
    const totalBags = b.bagCountS + b.bagCountM + b.bagCountXl;
    let listStatus = "pending";
    if (b.status === "CHECKED_OUT" || b.status === "CANCELLED") {
      listStatus = "completed";
    }

    return {
      bookingId: b.id,
      shortRef: "EMN-" + b.id.substring(0, 6).toUpperCase(),
      customer: b.guest?.name || tGuest("guestDefaultName"),
      time: `${b.checkInTime.toLocaleTimeString(timeLocale, { hour: "2-digit", minute: "2-digit" })} — ${t("checkInWord")}`,
      listStatus,
      bookingStatus: b.status,
      bags: `${totalBags} ${tGuest("bagsUnit")}`,
      phone: b.guest?.phone || "-",
    };
  });

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <header className="p-6 bg-white border-b border-gray-100 flex items-center gap-4 sticky top-0 z-10">
        <Link href="/partner" className="p-2 hover:bg-gray-100 rounded-full transition-colors">
          <ChevronLeft size={24} />
        </Link>
        <h1 className="text-xl font-black tracking-tight">{t("history")}</h1>
      </header>

      <main className="p-6 max-w-2xl mx-auto w-full flex flex-col gap-6">
        {tasks.length === 0 ? (
          <div className="bg-white rounded-3xl p-8 border border-gray-100 shadow-sm text-center text-gray-500 flex flex-col items-center">
            <Package size={48} className="text-gray-200 mb-4" />
            <h3 className="font-bold text-gray-900">{t("noBookingsYet")}</h3>
            <p className="text-sm mt-1">{t("noBookingsPartnerDesc")}</p>
          </div>
        ) : (
          tasks.map((task) => (
            <div
              key={task.bookingId}
              className="bg-white rounded-3xl p-6 border border-gray-100 shadow-sm flex flex-col gap-6"
            >
              <div className="flex justify-between items-start">
                <div className="flex items-center gap-3">
                  <div
                    className={`p-2 rounded-xl ${task.listStatus === "pending" ? "bg-orange-50 text-orange-600" : "bg-green-50 text-green-600"}`}
                  >
                    <Package size={20} />
                  </div>
                  <div>
                    <h3 className="font-bold text-gray-900">{task.customer}</h3>
                    <p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest">
                      {task.time} • {task.shortRef}
                    </p>
                  </div>
                </div>
                {task.listStatus === "completed" && (
                  <CheckCircle2 size={24} className="text-green-500" />
                )}
              </div>

              <div className="flex flex-col gap-3 text-sm text-gray-500 font-medium">
                <div className="flex items-center gap-2">
                  <Package size={16} className="text-gray-400" />
                  <span>{task.bags}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Phone size={16} className="text-gray-400" />
                  <span>{task.phone}</span>
                </div>
                <div className="flex items-center gap-2 text-[10px] font-black uppercase text-gray-400">
                  <Clock size={14} />
                  <span>
                    {tGuest("status")}: {task.bookingStatus}
                  </span>
                </div>
              </div>

              {task.bookingStatus === "PAID" && (
                <Link
                  href={`/partner?booking=${task.bookingId}`}
                  className="w-full bg-orange-600 text-white py-4 rounded-2xl text-xs font-black text-center uppercase tracking-widest hover:bg-orange-700 transition-colors"
                >
                  {t("customerArrivedCheckIn")}
                </Link>
              )}

              {task.bookingStatus === "CHECKED_IN" && (
                <Link
                  href={`/partner?checkoutBooking=${task.bookingId}`}
                  className="w-full bg-gray-900 text-white py-4 rounded-2xl text-xs font-black text-center uppercase tracking-widest hover:bg-black transition-colors"
                >
                  {t("handOverCheckout")}
                </Link>
              )}

              {task.bookingStatus === "PENDING" && (
                <p className="text-center text-xs font-bold text-amber-600 bg-amber-50 py-3 rounded-2xl">
                  {t("paymentPendingNoCheckIn")}
                </p>
              )}
            </div>
          ))
        )}
      </main>
    </div>
  );
}
