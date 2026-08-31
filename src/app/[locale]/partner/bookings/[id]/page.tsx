import { setRequestLocale, getTranslations } from "next-intl/server";
import {
  Calendar,
  ChevronLeft,
  Clock,
  Mail,
  MapPin,
  Package,
  Phone,
  MessageCircle,
} from "lucide-react";
import { Link } from "@/i18n/routing";
import { requirePartnerPage } from "@/lib/page-auth";
import { waMeUrl } from "@/lib/whatsapp";
import prisma from "@/lib/db";
import { notFound } from "next/navigation";
import { bcp47ForUiLocale } from "@/lib/intl-locale";
import { guestBookingStatusMessageKey } from "@/lib/booking-status-i18n";
import { formatTryCurrency } from "@/lib/currency";
import { moneyToNumber } from "@/lib/money";
import PartnerBookingActionLinks from "@/components/partner/PartnerBookingActionLinks";
import type { Metadata } from "next";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string; id: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "Partner" });
  return {
    title: t("partnerBookingDetailTitle"),
    robots: { index: false, follow: false },
  };
}

export default async function PartnerBookingDetailPage({
  params,
}: {
  params: Promise<{ locale: string; id: string }>;
}) {
  const { locale, id } = await params;
  setRequestLocale(locale);

  const t = await getTranslations("Partner");
  const tGuest = await getTranslations("Guest");

  const actor = await requirePartnerPage(locale, `/partner/bookings/${id}`);
  const userId = actor.id;

  const booking = await prisma.booking.findFirst({
    where: { id, shop: { ownerId: userId } },
    /*
      DAR SECIM (2026-08-31): `guest: true` misafirin `passwordHash`ini ve
      base64 avatarini (MB'lar) da getiriyordu; bu sayfa yalnizca ad, telefon
      ve e-posta yaziyor. `shop: true` de tum sutunlari getiriyordu; kullanilan
      tek alan `name`.
    */
    include: {
      guest: { select: { name: true, phone: true, email: true } },
      shop: { select: { name: true } },
    },
  });

  if (!booking) {
    notFound();
  }

  const dateLocale = bcp47ForUiLocale(locale);
  const fmt = (d: Date) =>
    d.toLocaleString(dateLocale, { dateStyle: "medium", timeStyle: "short" });

  /*
    Hazir mesaj BILEREK: esnaftan sifirdan cumle kurmasini beklemek, dugmeye
    basilmamasinin en yaygin sebebi. Kisa kod (`id`nin ilk 8 hanesi) misafirin
    KENDI ekraninda yazan sey -- iki taraf ayni referansi konusur.
  */
  const waLink = waMeUrl(
    booking.guest?.phone,
    t("partnerWhatsAppGuestMessage", {
      shop: booking.shop.name,
      code: booking.id.slice(0, 8).toUpperCase(),
    }),
  );

  const statusKey = guestBookingStatusMessageKey(booking.status);
  const statusLabel = statusKey ? tGuest(statusKey) : booking.status;
  const shortRef = "EMN-" + booking.id.substring(0, 6).toUpperCase();
  const totalBags = booking.bagCountS + booking.bagCountM + booking.bagCountXl;

  return (
    <div className="bg-gray-50 pb-20">
      <header className="sticky top-0 z-10 flex items-center gap-4 border-b border-gray-100 bg-white p-6">
        <Link href="/partner/bookings" className="rounded-full p-2 transition-colors hover:bg-gray-100">
          <ChevronLeft size={24} />
        </Link>
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-lg font-black tracking-tight">{t("partnerBookingDetailTitle")}</h1>
          <p className="id-eyebrow text-gray-400">{shortRef}</p>
        </div>
      </header>

      <div className="mx-auto flex max-w-2xl flex-col gap-6 p-6">
        <Link
          href="/partner/bookings"
          className="inline-flex items-center gap-2 text-xs id-eyebrow text-gray-400 hover:text-orange-600"
        >
          <ChevronLeft size={16} aria-hidden />
          {t("partnerBookingBackToList")}
        </Link>

        <div className="rounded-3xl border border-gray-100 bg-white p-6 shadow-sm">
          <div className="flex items-start gap-4">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-orange-50 text-orange-600">
              <MapPin size={22} />
            </div>
            <div className="min-w-0">
              <p className="id-eyebrow text-gray-400">
                {t("partnerBookingShopLabel")}
              </p>
              <p className="font-bold text-gray-900">{booking.shop.name}</p>
            </div>
          </div>

          <div className="mt-6 flex flex-wrap items-center gap-2 border-t border-gray-50 pt-6">
            <span className="rounded-full bg-gray-100 px-3 py-1 id-eyebrow text-gray-700">
              {tGuest("status")}: {statusLabel}
            </span>
          </div>
        </div>

        <div className="rounded-3xl border border-gray-100 bg-white p-6 shadow-sm">
          <h2 className="id-eyebrow text-gray-400">
            {t("partnerBookingGuestContact")}
          </h2>
          <p className="mt-1 text-xl font-black text-gray-900">
            {booking.guest?.name || tGuest("guestDefaultName")}
          </p>
          <div className="mt-4 flex flex-col gap-3 text-sm font-medium text-gray-600">
            {booking.guest?.phone ? (
              <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
                <a
                  href={`tel:${booking.guest.phone}`}
                  className="flex items-center gap-2 hover:text-orange-600"
                >
                  <Phone size={16} className="text-gray-400" />
                  {booking.guest.phone}
                </a>
                {/*
                  WHATSAPP. Turkiye'de esnafin birincil kanali WhatsApp ve
                  misafirlerin cogu YABANCI: uluslararasi arama hem pahali hem
                  de karsilikli dil bilinmeden ise yaramiyor. Esnafin SMS'i de
                  su an calismiyor (`netgsm.ts` bilerek devre disi), yani
                  geriye e-posta kaliyor -- esnaf e-postaya bakmiyor.

                  Numara wa.me bicimine cevrilemezse dugme HIC CIZILMEZ: bozuk
                  bir baglanti WhatsApp'ta "numara gecersiz" ekrani acar ve
                  esnaf hatanin kendisinde oldugunu sanir.
                */}
                {waLink && (
                  <a
                    href={waLink}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="id-pill flex items-center gap-1.5 bg-emerald-50 px-3 py-1.5 text-xs font-bold text-emerald-700 transition-colors hover:bg-emerald-100"
                  >
                    <MessageCircle size={14} />
                    {t("partnerWhatsAppGuest")}
                  </a>
                )}
              </div>
            ) : (
              <div className="flex items-center gap-2 text-gray-400">
                <Phone size={16} />
                —
              </div>
            )}
            {booking.guest?.email ? (
              <a
                href={`mailto:${booking.guest.email}`}
                className="flex items-center gap-2 break-all hover:text-orange-600"
              >
                <Mail size={16} className="shrink-0 text-gray-400" />
                {booking.guest.email}
              </a>
            ) : null}
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="rounded-2xl bg-gray-50 p-4">
            <div className="mb-1 flex items-center gap-2 id-eyebrow text-gray-400">
              <Calendar size={14} />
              {t("checkInWord")}
            </div>
            <p className="text-sm font-bold text-gray-900">{fmt(booking.checkInTime)}</p>
          </div>
          <div className="rounded-2xl bg-gray-50 p-4">
            <div className="mb-1 flex items-center gap-2 id-eyebrow text-gray-400">
              <Calendar size={14} />
              {t("partnerBookingsCheckOut")}
            </div>
            <p className="text-sm font-bold text-gray-900">{fmt(booking.checkOutTime)}</p>
          </div>
        </div>

        <div className="rounded-3xl border border-gray-100 bg-white p-6 shadow-sm">
          <div className="mb-4 flex items-center gap-2 id-eyebrow text-gray-400">
            <Package size={14} />
            {tGuest("bagCount")}
          </div>
          <ul className="space-y-2 text-sm font-medium text-gray-800">
            {booking.bagCountS > 0 ? (
              <li>
                {tGuest("smallBag")}: {booking.bagCountS}
              </li>
            ) : null}
            {booking.bagCountM > 0 ? (
              <li>
                {tGuest("mediumBag")}: {booking.bagCountM}
              </li>
            ) : null}
            {booking.bagCountXl > 0 ? (
              <li>
                {tGuest("xlBag")}: {booking.bagCountXl}
              </li>
            ) : null}
            {totalBags === 0 ? <li>—</li> : null}
          </ul>
          <div className="mt-6 flex items-center justify-between rounded-2xl bg-orange-600 px-4 py-4 text-white shadow-lg shadow-orange-100">
            <span className="font-bold">
              {totalBags} {tGuest("bagsUnit")}
            </span>
            <span className="text-lg font-black">
              {formatTryCurrency(moneyToNumber(booking.totalPrice), locale)}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2 text-xs text-gray-500">
          <Clock size={14} className="text-gray-400" />
          <span>
            {t("partnerBookingCreatedAt")}:{" "}
            {booking.createdAt.toLocaleString(dateLocale, {
              dateStyle: "medium",
              timeStyle: "short",
            })}
          </span>
        </div>

        <PartnerBookingActionLinks status={booking.status} bookingId={booking.id} />
      </div>
    </div>
  );
}
