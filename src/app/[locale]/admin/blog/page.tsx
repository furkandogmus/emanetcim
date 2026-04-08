import { setRequestLocale } from "next-intl/server";
import { getAllBlogPostsAction } from "@/actions/blog-actions";
import AdminBlogClient from "@/components/admin/AdminBlogClient";

export default async function AdminBlogPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  const posts = await getAllBlogPostsAction();

  return <AdminBlogClient posts={posts} />;
}
