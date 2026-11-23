/** `toMobileReview` (mobile-dto/review.ts). */
export type ShopReview = {
  id: string;
  rating: number;
  comment: string | null;
  createdAt: string;
  authorLabel: string;
};

/** `GET /shops/:id/reviews?paged=1`. */
export type ShopReviewsPage = { items: ShopReview[]; total: number; nextCursor: string | null };

/** `POST reviews`. Puan 1-5 tam sayi; yorum en cok 2000 karakter (ReviewService). */
export type CreateReviewRequest = { bookingId: string; rating: number; comment?: string };

export type CreateReviewResponse = { success: true; review: { id: string; rating: number } };
