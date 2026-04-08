import { setRequestLocale } from "next-intl/server";
import AdminBlogEditClient from "@/components/admin/AdminBlogEditClient";

export default async function AdminBlogNewPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  return <AdminBlogEditClient post={null} locale={locale} />;
}
