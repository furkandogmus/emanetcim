import type { ReviewSource } from "./internal";

/**
 * Dükkan yorumu. `authorLabel` yalnızca ilk ad — web `shop/[shopId]` sayfasıyla
 * aynı gizlilik kuralı: misafirin tam adı ya da fotoğrafı yorum listesinde
 * görünmez.
 */
export function toMobileReview(r: ReviewSource) {
  return {
    id: r.id,
    rating: r.rating,
    comment: r.comment,
    createdAt: r.createdAt.toISOString(),
    authorLabel: r.guest.name?.trim()?.split(/\s+/)[0] ?? "",
  };
}
