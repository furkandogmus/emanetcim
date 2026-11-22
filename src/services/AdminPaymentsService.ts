import { PaymentStatus } from "@prisma/client";
import prisma from "@/lib/db";
import { moneyToNumber } from "@/lib/money";

/**
 * Yonetici odeme defteri — SALT OKUNUR. Web `/admin/payments` ve mobil yonetici
 * ucu ayni sorguyu okur; iki ekranda farkli toplam gorunmesin.
 */

/** Tek sayfada gosterilen odeme sayisi. */
export const PAYMENT_PAGE_SIZE = 100;

/**
 * URL'den gelen durum dogrulanmadan Prisma'ya giderse sorgu firlar (500); taninmayan
 * deger filtresiz. `in` DEGIL: `?status=toString` prototip anahtariyla gecip 500 veriyordu.
 */
export function parsePaymentStatusFilter(status: string | null | undefined): PaymentStatus | null {
  return status && (Object.values(PaymentStatus) as string[]).includes(status) ? (status as PaymentStatus) : null;
}

export async function getPaymentsLedger(statusRaw: string | null | undefined) {
  const status = parsePaymentStatusFilter(statusRaw);
  const where = status ? { status } : {};

  const [payments, totals, refunded, pendingSplits, accounts, failedCount] = await Promise.all([
    prisma.paymentLog.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: PAYMENT_PAGE_SIZE,
      include: {
        split: { select: { status: true, merchantAmount: true, platformCommission: true } },
        booking: {
          select: {
            id: true,
            guestEmail: true,
            guest: { select: { name: true, email: true } },
            shop: { select: { name: true } },
          },
        },
      },
    }),
    // Yalnizca GERCEKTEN tahsil edilenler ciro sayilir; PENDING bir niyettir.
    prisma.paymentLog.aggregate({
      where: { status: { in: ["SUCCESS", "PARTIALLY_REFUNDED"] } },
      _sum: { amount: true },
      _count: true,
    }),
    prisma.paymentLog.aggregate({ _sum: { refundedAmount: true } }),
    prisma.paymentSplit.aggregate({
      where: { status: "PENDING" },
      _sum: { merchantAmount: true },
      _count: true,
    }),
    prisma.merchantPaymentAccount.findMany({
      orderBy: { updatedAt: "desc" },
      include: { shop: { select: { name: true, city: true } } },
    }),
    prisma.paymentLog.count({ where: { status: "FAILED" } }),
  ]);

  return {
    status: status ?? "ALL",
    summary: {
      capturedAmount: moneyToNumber(totals._sum.amount ?? 0),
      capturedCount: totals._count,
      refundedAmount: moneyToNumber(refunded._sum.refundedAmount ?? 0),
      pendingSplitAmount: moneyToNumber(pendingSplits._sum.merchantAmount ?? 0),
      pendingSplitCount: pendingSplits._count,
      failedCount,
    },
    payments: payments.map((p) => ({
      id: p.id,
      bookingId: p.bookingId,
      status: p.status,
      provider: p.provider,
      amount: moneyToNumber(p.amount),
      refundedAmount: moneyToNumber(p.refundedAmount),
      failureReason: p.failureReason,
      chargebackStatus: p.chargebackStatus,
      createdAt: p.createdAt.toISOString(),
      capturedAt: p.capturedAt?.toISOString() ?? null,
      guestLabel: p.booking.guest?.name ?? p.booking.guest?.email ?? p.booking.guestEmail,
      shopName: p.booking.shop.name,
      splitStatus: p.split?.status ?? null,
      merchantAmount: p.split ? moneyToNumber(p.split.merchantAmount) : null,
      platformCommission: p.split ? moneyToNumber(p.split.platformCommission) : null,
    })),
    accounts: accounts.map((a) => ({
      id: a.id,
      shopName: a.shop.name,
      city: a.shop.city,
      provider: a.provider,
      status: a.status,
      rejectionReason: a.rejectionReason,
      activatedAt: a.activatedAt?.toISOString() ?? null,
    })),
  };
}

export type PaymentsLedger = Awaited<ReturnType<typeof getPaymentsLedger>>;
