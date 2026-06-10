import { setRequestLocale } from "next-intl/server";
import { auth } from "@/auth";
import { redirect, notFound } from "next/navigation";
import AdminBlogEditClient from "@/components/admin/AdminBlogEditClient";
import prisma from "@/lib/db";

export default async function AdminBlogEditPage({
  params,
}: {
  params: Promise<{ locale: string; id: string }>;
}) {
  const { locale, id } = await params;
  setRequestLocale(locale);

  const session = await auth();
  if (!session?.user || session.user.role !== "ADMIN") {
    redirect(`/${locale}/login`);
  }

  const post = await prisma.blogPost.findUnique({
    where: { id },
  });

  if (!post) {
    notFound();
  }

  return <AdminBlogEditClient post={post} locale={locale} />;
}
