import { setRequestLocale } from "next-intl/server";
import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { searchAdminBookings } from "@/lib/admin/booking-search";
import AdminBookingsClient from "@/components/admin/AdminBookingsClient";

/**
 * Rezervasyon arama ekranı.
 *
 * Arama SUNUCUDA yapılır (URL'deki `q`), istemcide filtrelenen bir liste
 * değildir: destek talebi geldiğinde aranan kayıt son 50 rezervasyonun içinde
 * olmayabilir ve tarayıcıya tüm rezervasyonları indirmek ne mümkün ne doğru.
 * URL'de durması ayrıca aramanın paylaşılabilir olmasını sağlar — yönetici
 * bağlantıyı bir başkasına yollayabilir.
 */
export default async function AdminBookingsPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ q?: string; status?: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  const session = await auth();
  if (session?.user?.role !== "ADMIN") {
    redirect(`/${locale}/login`);
  }

  const { q = "", status = "ALL" } = await searchParams;
  const bookings = await searchAdminBookings(q, status);

  return <AdminBookingsClient bookings={bookings} query={q} status={status} />;
}
