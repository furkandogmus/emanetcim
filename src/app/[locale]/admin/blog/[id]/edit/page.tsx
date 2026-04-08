import { setRequestLocale } from "next-intl/server";
import AdminBlogEditClient from "@/components/admin/AdminBlogEditClient";
import prisma from "@/lib/db";
import { notFound } from "next/navigation";

export default async function AdminBlogEditPage({
  params,
}: {
  params: Promise<{ locale: string; id: string }>;
}) {
  const { locale, id } = await params;
  setRequestLocale(locale);

  const post = await prisma.blogPost.findUnique({
    where: { id },
  });

  if (!post) {
    notFound();
  }

  return <AdminBlogEditClient post={post} locale={locale} />;
}
