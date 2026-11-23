import { setRequestLocale } from "next-intl/server";
import { requireAdminPage } from "@/lib/page-auth";
import { listAffiliatesForAdmin } from "@/services/AffiliateService";
import { toMobileAdminAffiliate } from "@/lib/mobile-dto";
import AdminAffiliatesClient from "@/components/admin/AdminAffiliatesClient";

/** Araci programi: liste, onay, oranlar, ay sonu odeme isareti ve CSV. */
export default async function AdminAffiliatesPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  await requireAdminPage(locale, "/admin/affiliates");
  const rows = await listAffiliatesForAdmin();
  // Web ve mobil yonetici ayni alanlari gorur.
  return <AdminAffiliatesClient affiliates={rows.map(toMobileAdminAffiliate)} />;
}
