import { setRequestLocale } from "next-intl/server";
import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { getAllBlogPostsAction } from "@/actions/blog-actions";
import AdminBlogClient from "@/components/admin/AdminBlogClient";

export default async function AdminBlogPage({
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

  const posts = await getAllBlogPostsAction();

  return <AdminBlogClient posts={posts} />;
}
