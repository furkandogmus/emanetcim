import prisma from "@/lib/db";
import { VISIBLE_REVIEW } from "@/lib/review-visibility";

export type HomeTestimonial = {
  id: string;
  comment: string;
  rating: number;
  shopName: string;
  authorLabel: string;
};

/**
 * Ana sayfa için son misafir yorumları (carousel).
 */
export async function getHomeTestimonials(
  limit = 14,
): Promise<HomeTestimonial[]> {
  try {
    const rows = await prisma.review.findMany({
      /*
        Test dukkaninin yorumu ana sayfada cikmaz (2026-11-23): kum havuzu
        hesaplari test dukkanina rezervasyon ve yorum yapabiliyor; carousel
        dukkan ADINI da basiyor, yani test kaydi kamuya sizardi.
      */
      where: { comment: { not: null }, ...VISIBLE_REVIEW, shop: { isTest: false } },
      orderBy: { createdAt: "desc" },
      take: limit,
      include: {
        shop: { select: { name: true } },
        guest: { select: { name: true } },
      },
    });

    return rows
      .map((r) => {
        const comment = r.comment?.trim() ?? "";
        if (!comment) return null;
        const authorLabel =
          r.guest?.name?.trim()?.split(/\s+/)[0] || "Guest";
        return {
          id: r.id,
          comment,
          rating: r.rating,
          shopName: r.shop.name,
          authorLabel,
        };
      })
      .filter(Boolean) as HomeTestimonial[];
  } catch {
    return [];
  }
}
