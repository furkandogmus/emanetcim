import { NextResponse } from "next/server";
import { resolveMobileShopViewer } from "@/lib/mobile-auth";
import { ShopService } from "@/services/ShopService";
import { reviewService } from "@/services/ReviewService";
import { toMobileReview } from "@/lib/mobile-dto";
import { parseCursor, parseLimit } from "@/lib/cursor-page";

const shopService = new ShopService();

/**
 * `?paged=1[&cursor=&limit=]` -> `{ items, total, nextCursor }`. Parametresiz istek
 * eski uygulama surumleri (0.3.0-0.3.3) icin eskisi gibi dizi doner.
 */
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  /*
    `shops/[id]/route.ts` ile AYNI FILTRE: dukkan once genel goruculukten
    gecmeli, yoksa test/pasif bir dukkanin yorumlari kimligi bilen herkese
    aciliyor.
  */
  const shop = await shopService.getPublicShopById(id, await resolveMobileShopViewer(req));
  if (!shop) return NextResponse.json({ error: "not_found" }, { status: 404 });

  const sp = new URL(req.url).searchParams;
  if (sp.get("paged") === "1") {
    const page = await reviewService.listShopReviews(id, {
      cursor: parseCursor(sp.get("cursor")),
      take: parseLimit(sp.get("limit"), 20, 50),
    });
    return NextResponse.json({ items: page.items.map(toMobileReview), total: page.total, nextCursor: page.nextCursor });
  }

  const reviews = await reviewService.getShopReviews(id);
  return NextResponse.json(reviews.map(toMobileReview));
}
