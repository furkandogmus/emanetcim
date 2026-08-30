import { setRequestLocale } from "next-intl/server";
import { auth } from "@/auth";
import { redirect, notFound } from "next/navigation";
import prisma from "@/lib/db";
import { moneyToNumber } from "@/lib/money";
import AdminBookingDetailClient from "@/components/admin/AdminBookingDetailClient";

/**
 * Tek rezervasyonun tam görünümü.
 *
 * NEDEN BURADA HER ŞEY BİR ARADA: destek talebi "rezervasyonun durumu ne" diye
 * gelmez; "para çekildi mi, mühür takıldı mı, misafire e-posta gitti mi, kim ne
 * zaman ne yaptı" diye gelir. Bunlar beş ayrı tabloda duruyor ve şu ana kadar
 * hiçbir ekranda yan yana gelmiyordu. Yönetici cevabı bulmak için beş sorgu
 * yazmak zorundaysa, cevabı bulmaz.
 *
 * `BookingEvent` zaten `BookingEventService` tarafından yazılıyordu ama HİÇ
 * gösterilmiyordu — yazılıp okunmayan bir olay defteri, defter değildir.
 */
export default async function AdminBookingDetailPage({
  params,
}: {
  params: Promise<{ locale: string; id: string }>;
}) {
  const { locale, id } = await params;
  setRequestLocale(locale);

  const session = await auth();
  if (session?.user?.role !== "ADMIN") {
    redirect(`/${locale}/login`);
  }

  const booking = await prisma.booking.findUnique({
    where: { id },
    include: {
      guest: { select: { id: true, name: true, email: true, phone: true } },
      shop: { select: { id: true, name: true, city: true, district: true } },
      paymentLog: { include: { split: true } },
      dispute: { select: { id: true, status: true, reason: true } },
      review: { select: { rating: true, comment: true } },
      seals: {
        orderBy: { bagIndex: "asc" },
        include: { seal: { select: { status: true } } },
      },
      notificationLogs: {
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          type: true,
          recipient: true,
          status: true,
          error: true,
          createdAt: true,
        },
      },
      reservationSlots: { select: { id: true } },
    },
  });

  if (!booking) notFound();

  /*
    `BookingEvent`in `Booking` uzerinde bir iliskisi yok (serbest defter),
    dolayisiyla ayri okunur.
  */
  const events = await prisma.bookingEvent.findMany({
    where: { bookingId: id },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      event: true,
      actorId: true,
      actorRole: true,
      metadata: true,
      createdAt: true,
    },
  });

  const payment = booking.paymentLog;

  return (
    <AdminBookingDetailClient
      booking={{
        id: booking.id,
        status: booking.status,
        createdAt: booking.createdAt.toISOString(),
        checkInTime: booking.checkInTime.toISOString(),
        checkOutTime: booking.checkOutTime.toISOString(),
        checkedInAt: booking.checkedInAt?.toISOString() ?? null,
        checkedOutAt: booking.checkedOutAt?.toISOString() ?? null,
        bagCountS: booking.bagCountS,
        bagCountM: booking.bagCountM,
        bagCountXl: booking.bagCountXl,
        unitPrice: moneyToNumber(booking.unitPrice),
        totalPrice: moneyToNumber(booking.totalPrice),
        insuranceFee: moneyToNumber(booking.insuranceFee),
        lateFeeApplied: moneyToNumber(booking.lateFeeApplied),
        referralDiscountAmount: moneyToNumber(booking.referralDiscountAmount),
        referredByCode: booking.referredByCode,
        qrCodeToken: booking.qrCodeToken,
        slotCount: booking.reservationSlots.length,
        guest: booking.guest,
        guestEmail: booking.guestEmail,
        guestPhone: booking.guestPhone,
        shop: booking.shop,
        dispute: booking.dispute,
        review: booking.review
          ? { rating: booking.review.rating, comment: booking.review.comment }
          : null,
        seals: booking.seals.map((s) => ({
          id: s.id,
          serialNumber: s.sealNumber,
          bagIndex: s.bagIndex,
          bagSize: s.bagSize,
          sealStatus: s.seal.status,
        })),
        notifications: booking.notificationLogs.map((n) => ({
          ...n,
          createdAt: n.createdAt.toISOString(),
        })),
      }}
      payment={
        payment
          ? {
              status: payment.status,
              provider: payment.provider,
              providerRef: payment.providerRef,
              transactionId: payment.transactionId,
              amount: moneyToNumber(payment.amount),
              refundedAmount: moneyToNumber(payment.refundedAmount),
              failureReason: payment.failureReason,
              chargebackStatus: payment.chargebackStatus,
              capturedAt: payment.capturedAt?.toISOString() ?? null,
              refundedAt: payment.refundedAt?.toISOString() ?? null,
              split: payment.split
                ? {
                    status: payment.split.status,
                    grossAmount: moneyToNumber(payment.split.grossAmount),
                    platformCommission: moneyToNumber(payment.split.platformCommission),
                    merchantAmount: moneyToNumber(payment.split.merchantAmount),
                    settledAt: payment.split.settledAt?.toISOString() ?? null,
                  }
                : null,
            }
          : null
      }
      events={events.map((e) => ({
        id: e.id,
        event: e.event,
        actorId: e.actorId,
        actorRole: e.actorRole,
        metadata: e.metadata === null ? null : JSON.stringify(e.metadata),
        createdAt: e.createdAt.toISOString(),
      }))}
    />
  );
}
