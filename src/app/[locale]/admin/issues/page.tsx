import { setRequestLocale } from "next-intl/server";
import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { teamIssueService } from "@/services/TeamIssueService";
import AdminIssuesClient from "@/components/admin/AdminIssuesClient";

export default async function AdminIssuesPage({
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

  return <AdminIssuesClient initialIssues={issues} />;
}
