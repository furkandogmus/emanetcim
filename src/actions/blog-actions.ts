"use server";

import prisma from "@/lib/db";
import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/action-auth";
import { sanitizeRichText } from "@/lib/rich-text";

type BlogPostFormData = {
  id?: string;
  title: string;
  slug: string;
  content: string;
  excerpt?: string;
  coverImage?: string;
  locale: string;
  isPublished?: boolean;
};

/**
 * Yeni blog yazısı oluşturur veya mevcut olanı günceller.
 */
export async function upsertBlogPostAction(formData: BlogPostFormData) {
  const auth = await requireAdmin();
  if (!auth.ok) return { success: false, error: auth.error };

  const { id, title, slug, excerpt, coverImage, locale, isPublished } = formData;
  const content = sanitizeRichText(formData.content);

  const data = {
    title,
    slug,
    content,
    excerpt,
    coverImage,
    locale,
    isPublished: !!isPublished,
  };

  if (id) {
    await prisma.blogPost.update({
      where: { id },
      data,
    });
  } else {
    await prisma.blogPost.create({
      data,
    });
  }

  revalidatePath("/[locale]/blog", "layout");
  revalidatePath("/[locale]/admin/blog", "layout");
  return { success: true };
}

/**
 * Blog yazısını siler.
 */
export async function deleteBlogPostAction(id: string) {
  const auth = await requireAdmin();
  if (!auth.ok) return { success: false, error: auth.error };

  await prisma.blogPost.delete({
    where: { id },
  });

  revalidatePath("/[locale]/blog", "layout");
  revalidatePath("/[locale]/admin/blog", "layout");
  return { success: true };
}

/**
 * Tüm blog yazılarını getirir (Admin tarafı için).
 */
export async function getAllBlogPostsAction() {
  const auth = await requireAdmin();
  if (!auth.ok) return [];

  return await prisma.blogPost.findMany({
    orderBy: { createdAt: "desc" },
  });
}
