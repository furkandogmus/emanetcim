import { setRequestLocale } from "next-intl/server";
import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { teamIssueService } from "@/services/TeamIssueService";
import AdminSorunlarClient from "@/components/admin/AdminSorunlarClient";

export default async function AdminSorunlarPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  const session = await auth();
  if (!session?.user || session.user.role !== "ADMIN") {
    redirect(`/${locale}/login`);
  }

  const issues = await teamIssueService.listIssues();

  return <AdminSorunlarClient initialIssues={issues} />;
}
