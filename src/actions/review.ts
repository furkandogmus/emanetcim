"use server";

import { auth } from "@/auth";
import { reviewService } from "@/services/ReviewService";
import { revalidatePathAllLocales } from "@/lib/revalidate-locales";
import prisma from "@/lib/db";

/**
 * addReviewAction - Misafirin tamamlanan rezervasyonu değerlendirdiği adım.
 */
export async function addReviewAction(data: {
  bookingId: string;
  guestId: string;
  shopId: string;
  rating: number;
  comment?: string;
}) {
  const session = await auth();

  if (!session?.user?.id || session.user.id !== data.guestId) {
    throw new Error("Bu işlemi yapmaya yetkiniz yok.");
  }

  if (data.rating < 1 || data.rating > 5) {
    return { success: false, error: "Puan 1 ile 5 arasında olmalıdır." };
  }

  const booking = await prisma.booking.findUnique({
    where: { id: data.bookingId },
  });
  if (!booking || booking.guestId !== session.user.id) {
    return { success: false, error: "Rezervasyon bulunamadı veya yetkisiz." };
  }
  if (booking.status !== "CHECKED_OUT") {
    return {
      success: false,
      error: "Yorum yalnızca teslim tamamlandıktan sonra yapılabilir.",
    };
  }

  try {
    const review = await reviewService.addReview(data);

    revalidatePathAllLocales("/bookings");
    revalidatePathAllLocales("/search");

    return { success: true, review };
  } catch (error: unknown) {
    const err = error as { code?: string };
    console.error("addReviewAction Error:", error);
    if (err.code === "P2002") {
      return { success: false, error: "Bu rezervasyon için zaten bir yorum yapılmış." };
    }
    return { success: false, error: "Yorum kaydedilirken bir hata oluştu." };
  }
}
