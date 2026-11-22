import { setRequestLocale } from "next-intl/server";
import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { getPaymentsLedger } from "@/services/AdminPaymentsService";
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
  // Sorgu ve donusum `getPaymentsLedger`da; mobil yonetici ucu ayni defteri okur.
  const ledger = await getPaymentsLedger(status);

  return (
    <AdminPaymentsClient
      status={status}
      summary={ledger.summary}
      payments={ledger.payments}
      accounts={ledger.accounts}
    />
  );
}
