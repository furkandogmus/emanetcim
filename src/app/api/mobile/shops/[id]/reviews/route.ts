import { NextResponse } from "next/server";
import { ShopService } from "@/services/ShopService";
import { reviewService } from "@/services/ReviewService";
import { toMobileReview } from "@/lib/mobile-dto";

const shopService = new ShopService();

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  /*
    `shops/[id]/route.ts` ile AYNI FILTRE: dukkan once genel goruculukten
    gecmeli, yoksa test/pasif bir dukkanin yorumlari kimligi bilen herkese
    aciliyor.
  */
  const shop = await shopService.getPublicShopById(id);
  if (!shop) return NextResponse.json({ error: "not_found" }, { status: 404 });

  const reviews = await reviewService.getShopReviews(id);
  return NextResponse.json(reviews.map(toMobileReview));
}
