"use server";

import { auth } from "@/auth";
import prisma from "@/lib/db";
import { revalidatePath } from "next/cache";

/**
 * Yeni blog yazısı oluşturur veya mevcut olanı günceller.
 */
export async function upsertBlogPostAction(formData: Record<string, any>) {
  const session = await auth();
  if (session?.user?.role !== "ADMIN") {
    throw new Error("Yetkisiz işlem.");
  }

  const { id, title, slug, content, excerpt, coverImage, locale, isPublished } = formData;

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
  const session = await auth();
  if (session?.user?.role !== "ADMIN") {
    throw new Error("Yetkisiz işlem.");
  }

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
  const session = await auth();
  if (session?.user?.role !== "ADMIN") {
    throw new Error("Yetkisiz işlem.");
  }

  return await prisma.blogPost.findMany({
    orderBy: { createdAt: "desc" },
  });
}
