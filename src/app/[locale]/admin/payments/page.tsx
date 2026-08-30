import { setRequestLocale } from "next-intl/server";
import { auth } from "@/auth";
import { redirect } from "next/navigation";
import prisma from "@/lib/db";
import { PaymentStatus } from "@prisma/client";
import { moneyToNumber } from "@/lib/money";
import AdminPaymentsClient from "@/components/admin/AdminPaymentsClient";

/**
 * Ödeme defteri — SALT OKUNUR.
 *
 * NEDEN HİÇ BUTON YOK: bu ekran bilerek yalnızca gösteriyor. 2026-08-29'da bir
 * admin ödeme ekranı eklenip aynı gün geri alındı (`c0deacc` → `ce70934`),
 * çünkü arkasında karşılığı olmayan bir "ödemeyi kapat" anahtarı vaat ediyordu.
 * Çalışmayan bir buton, olmayan bir butondan kötüdür: yönetici ona basar,
 * bir şey olduğunu sanır ve para yolunda yanlış bir varsayımla ilerler.
 *
 * İade / kapatma buraya ancak `PaymentService` tarafında gerçekten çalışan bir
 * yol olduğunda eklenir — ve o zaman da `PaymentLog`a elle değil, servis
 * üzerinden yazılır (CLAUDE.md: para yalnızca `PaymentService` ile değişir).
 *
 * BU EKRAN NE CEVAPLIYOR: hangi ödemeler başarısız, ne kadar iade edildi, hangi
 * esnaf payı hâlâ aktarılmamış, hangi dükkanın ödeme hesabı aktif değil.
 * Bunların hiçbiri bugüne kadar hiçbir ekranda görünmüyordu — dördü de yalnızca
 * veritabanında duruyordu.
 */

/** Tek sayfada gösterilen ödeme sayısı. */
const PAYMENT_PAGE_SIZE = 100;

export default async function AdminPaymentsPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ status?: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  const session = await auth();
  if (session?.user?.role !== "ADMIN") {
    redirect(`/${locale}/login`);
  }

  const { status = "ALL" } = await searchParams;
  /*
    Durum URL'den geliyor: dogrulanmadan Prisma'ya verilen gecersiz bir enum
    degeri sorguyu firlattirir ve ekran 500 doner. Taninmayan deger filtresiz
    sayilir.
  */
  const where = status in PaymentStatus ? { status: status as PaymentStatus } : {};

  const [payments, totals, refunded, pendingSplits, accounts] = await Promise.all([
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
  ]);

  const failedCount = await prisma.paymentLog.count({ where: { status: "FAILED" } });

  return (
    <AdminPaymentsClient
      status={status}
      summary={{
        capturedAmount: moneyToNumber(totals._sum.amount ?? 0),
        capturedCount: totals._count,
        refundedAmount: moneyToNumber(refunded._sum.refundedAmount ?? 0),
        pendingSplitAmount: moneyToNumber(pendingSplits._sum.merchantAmount ?? 0),
        pendingSplitCount: pendingSplits._count,
        failedCount,
      }}
      payments={payments.map((p) => ({
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
      }))}
      accounts={accounts.map((a) => ({
        id: a.id,
        shopName: a.shop.name,
        city: a.shop.city,
        provider: a.provider,
        status: a.status,
        rejectionReason: a.rejectionReason,
        activatedAt: a.activatedAt?.toISOString() ?? null,
      }))}
    />
  );
}
