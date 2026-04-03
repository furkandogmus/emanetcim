"use server";

import { auth } from "@/auth";
import { reviewService } from "@/services/ReviewService";
import { revalidatePathAllLocales } from "@/lib/revalidate-locales";

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

  // Puan kontrolü (1-5 arası)
  if (data.rating < 1 || data.rating > 5) {
    return { success: false, error: "Puan 1 ile 5 arasında olmalıdır." };
  }

  try {
    const review = await reviewService.addReview(data);
    
    revalidatePathAllLocales("/bookings");
    revalidatePathAllLocales("/search");

    return { success: true, review };
  } catch (error: any) {
    console.error("addReviewAction Error:", error);
    if (error.code === 'P2002') {
       return { success: false, error: "Bu rezervasyon için zaten bir yorum yapılmış." };
    }
    return { success: false, error: "Yorum kaydedilirken bir hata oluştu." };
  }
}
