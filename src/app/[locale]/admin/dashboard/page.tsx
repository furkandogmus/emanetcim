import { redirect } from "next/navigation";

/**
 * Eski /admin/dashboard bağlantıları için locale ile yönlendirme.
 */
export default async function AdminDashboardFallback({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  redirect(`/${locale}/admin`);
}
