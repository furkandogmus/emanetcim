import { setRequestLocale, getTranslations } from "next-intl/server";
import { ChevronLeft, Package, Clock, CheckCircle2, Phone, ChevronRight } from "lucide-react";
import { Link } from "@/i18n/routing";
import { requirePartnerPage } from "@/lib/page-auth";
import prisma from "@/lib/db";
import { bcp47ForUiLocale } from "@/lib/intl-locale";
import { guestBookingStatusMessageKey } from "@/lib/booking-status-i18n";
import {
  parsePartnerBookingsFilter,
  partnerBookingsFilterStatuses,
  type PartnerBookingsFilter,
} from "@/lib/partner-bookings-filter";
import PartnerBookingsFilterTabs from "@/components/partner/PartnerBookingsFilterTabs";
import PartnerBookingActionLinks from "@/components/partner/PartnerBookingActionLinks";

const PAGE_SIZE = 30;

/**
 * Partner Bookings / History Page - Esnaf Takvimi
 * ?filter=all|action|payment|done&page=1
 */
export default async function PartnerBookingsPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams?: Promise<{ filter?: string; page?: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  const t = await getTranslations("Partner");
  const tGuest = await getTranslations("Guest");

  const actor = await requirePartnerPage(locale, "/partner/bookings");
  const userId = actor.id;

  const sp = (await searchParams) ?? {};
  const filter: PartnerBookingsFilter = parsePartnerBookingsFilter(sp.filter);
  const page = Math.max(1, parseInt(sp.page ?? "1", 10) || 1);

  /**
   * NEDEN (2026-08-25): `filter` yalnızca ayrıştırılıp URL/aktif-sekme
   * gösterimi için kullanılıyordu — sorgunun `where` koşuluna HİÇ
   * eklenmiyordu. Yani partner "Ödeme Bekleyen" ya da "Tamamlanan" sekmesine
   * tıkladığında sunucu her zaman AYNI, filtrelenmemiş tam listeyi
   * döndürüyordu; sekmeler görsel olarak seçili görünüyor ama hiçbir şeyi
   * değiştirmiyordu. Sayfalama da (`totalCount`/`totalPages`) aynı sebeple
   * yanlıştı — her zaman TÜM rezervasyonları sayıyordu, filtrelenmiş alt
   * kümeyi değil.
   */
  const filterStatuses = partnerBookingsFilterStatuses(filter);
  const where = {
    shop: { ownerId: userId },
    ...(filterStatuses ? { status: { in: filterStatuses } } : {}),
  };

  const [totalCount, dbBookings] = await Promise.all([
    prisma.booking.count({ where }),
    prisma.booking.findMany({
      where,
      /*
      DAR SECIM (2026-08-31). Onceki hali `include: { guest: true }` idi, yani
      her satirla birlikte TAM `User` kaydi geliyordu: `passwordHash` ve --
      asil maliyet -- `image`. `image` bir base64 data URL (avatar 2 MB'a kadar,
      base64 ile ~2,7 MB) ve bu sorgu sayfa basina PAGE_SIZE kayit donduruyor. Yani
      avatarli misafirlerin oldugu bir sayfa on megabaytlarca metni bosuna
      cekiyordu. Ayni sinif hata mobil `requireMobileUser`da da vardi.

      `passwordHash`in sunucu bileseninin bellegine girmemesi ikinci kazanc:
      bugun hicbir sey onu istemciye gecirmiyor (alanlar tek tek yaziliyor) ama
      bir gun biri nesneyi oldugu gibi bir istemci bilesenine verirse bcrypt
      hash'i RSC yukuyle tarayiciya gider.
    */
      include: { guest: { select: { name: true, phone: true } } },
      orderBy: { checkInTime: "desc" },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
    }),
  ]);

  const totalPages = Math.ceil(totalCount / PAGE_SIZE);

  const timeLocale = bcp47ForUiLocale(locale);

  const fmtDt = (d: Date) =>
    d.toLocaleString(timeLocale, { dateStyle: "short", timeStyle: "short" });

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
      scheduleLine: `${fmtDt(b.checkInTime)} — ${t("checkInWord")} · ${fmtDt(b.checkOutTime)} — ${t("partnerBookingsCheckOut")}`,
      listStatus,
      bookingStatus: b.status,
      bags: `${totalBags} ${tGuest("bagsUnit")}`,
      phone: b.guest?.phone || "-",
    };
  });

  const filterLabels: Record<PartnerBookingsFilter, string> = {
    all: t("partnerBookingsFilterAll"),
    action: t("partnerBookingsFilterAction"),
    payment: t("partnerBookingsFilterPayment"),
    done: t("partnerBookingsFilterDone"),
  };

  const qs = (p: number) => {
    const params = new URLSearchParams();
    if (filter !== "all") params.set("filter", filter);
    if (p > 1) params.set("page", String(p));
    const q = params.toString();
    return q ? `?${q}` : "";
  };

  return (
    <div className="flex min-h-screen flex-col bg-gray-50">
      <header className="sticky top-0 z-10 flex items-center gap-4 border-b border-gray-100 bg-white p-6">
        <Link href="/partner" className="rounded-full p-2 transition-colors hover:bg-gray-100">
          <ChevronLeft size={24} />
        </Link>
        <h1 className="text-xl font-black tracking-tight">{t("history")}</h1>
      </header>

      <div className="mx-auto flex w-full max-w-2xl flex-col gap-6 p-6">
        {totalCount > 0 ? (
          <PartnerBookingsFilterTabs
            current={filter}
            labels={filterLabels}
            ariaLabel={t("partnerBookingsFilterAria")}
          />
        ) : null}

        {totalCount === 0 ? (
          <div className="flex flex-col items-center rounded-3xl border border-gray-100 bg-white p-8 text-center text-gray-500 shadow-sm">
            <Package size={48} className="mb-4 text-gray-200" />
            <h3 className="font-bold text-gray-900">{t("noBookingsYet")}</h3>
            <p className="mt-1 text-sm">{t("noBookingsPartnerDesc")}</p>
          </div>
        ) : tasks.length === 0 ? (
          <div className="rounded-3xl border border-gray-100 bg-white p-8 text-center text-sm font-medium text-gray-500 shadow-sm">
            {t("partnerBookingsEmptyFilter")}
          </div>
        ) : (
          tasks.map((task) => (
            <div
              key={task.bookingId}
              className="flex flex-col gap-6 rounded-3xl border border-gray-100 bg-white p-6 shadow-sm"
            >
              <div className="flex justify-between gap-3">
                <div className="flex min-w-0 flex-1 items-start gap-3">
                  <div
                    className={`shrink-0 rounded-xl p-2 ${task.listStatus === "pending" ? "bg-orange-50 text-orange-600" : "bg-green-50 text-green-600"}`}
                  >
                    <Package size={20} />
                  </div>
                  <div className="min-w-0">
                    <h3 className="font-bold text-gray-900">{task.customer}</h3>
                    <p className="id-eyebrow text-gray-400">
                      {task.shortRef}
                    </p>
                    <p className="mt-1 text-xs font-medium leading-snug text-gray-500">
                      {task.scheduleLine}
                    </p>
                  </div>
                </div>
                <div className="flex shrink-0 flex-col items-end gap-2">
                  {task.listStatus === "completed" ? (
                    <CheckCircle2 size={24} className="text-green-500" />
                  ) : null}
                  <Link
                    href={`/partner/bookings/${task.bookingId}`}
                    className="id-eyebrow text-orange-600 hover:underline"
                  >
                    {t("partnerBookingViewDetail")}
                  </Link>
                </div>
              </div>

              <div className="flex flex-col gap-3 text-sm font-medium text-gray-500">
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
                    {tGuest("status")}:{" "}
                    {(() => {
                      const sk = guestBookingStatusMessageKey(task.bookingStatus);
                      return sk ? tGuest(sk) : task.bookingStatus;
                    })()}
                  </span>
                </div>
              </div>

              <PartnerBookingActionLinks status={task.bookingStatus} bookingId={task.bookingId} />
            </div>
          ))
        )}

        {totalPages > 1 && (
          <nav
            className="flex items-center justify-center gap-4 pt-4"
            aria-label={t("pagination")}
          >
            {/*
              `pointer-events-none` + `aria-disabled` yalnizca FAREYI durdurur.
              Link hala gercek bir `href` tasidigi icin klavye kullanicisi
              Tab'la gelip Enter'a basarak sinirin OTESINE gecebiliyordu --
              son sayfadayken "Sonraki" bos bir sayfaya goturuyordu. Sinirda
              gercek bir baglanti yerine erisilemez bir `span` render edilir.
            */}
            {page <= 1 ? (
              <span
                aria-disabled="true"
                className="inline-flex items-center gap-1 rounded-xl px-4 py-2 text-sm font-bold text-gray-300"
              >
                <ChevronLeft size={16} />
                {t("prevPage")}
              </span>
            ) : (
              <Link
                href={qs(page - 1)}
                className="inline-flex items-center gap-1 rounded-xl px-4 py-2 text-sm font-bold text-gray-600 transition-colors hover:bg-gray-200"
              >
                <ChevronLeft size={16} />
                {t("prevPage")}
              </Link>
            )}
            <span className="text-xs font-bold text-gray-400">
              {page} / {totalPages}
            </span>
            {page >= totalPages ? (
              <span
                aria-disabled="true"
                className="inline-flex items-center gap-1 rounded-xl px-4 py-2 text-sm font-bold text-gray-300"
              >
                {t("nextPage")}
                <ChevronRight size={16} />
              </span>
            ) : (
              <Link
                href={qs(page + 1)}
                className="inline-flex items-center gap-1 rounded-xl px-4 py-2 text-sm font-bold text-gray-600 transition-colors hover:bg-gray-200"
              >
                {t("nextPage")}
                <ChevronRight size={16} />
              </Link>
            )}
          </nav>
        )}
      </div>
    </div>
  );
}
