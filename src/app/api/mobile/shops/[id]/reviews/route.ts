import { NextResponse } from "next/server";
import { markAuthStale, resolveMobileShopViewer } from "@/lib/mobile-auth";
import type { ShopViewer } from "@/lib/public-shop-filter";
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
  const { viewer, stale } = await resolveMobileShopViewer(req);
  return markAuthStale(await reviews(req, (await params).id, viewer), stale);
}

async function reviews(req: Request, id: string, viewer: (ShopViewer & { id?: string }) | null) {
  /*
    `shops/[id]/route.ts` ile AYNI FILTRE: dukkan once genel goruculukten
    gecmeli, yoksa test/pasif bir dukkanin yorumlari kimligi bilen herkese
    aciliyor.
  */
  const shop = await shopService.getPublicShopById(id, viewer);
  if (!shop) return NextResponse.json({ error: "not_found" }, { status: 404 });

  const sp = new URL(req.url).searchParams;
  if (sp.get("paged") === "1") {
    const page = await reviewService.listShopReviews(id, {
      cursor: parseCursor(sp.get("cursor")),
      take: parseLimit(sp.get("limit"), 20, 50),
      // "Bu kullanicinin yorumlarini gizle": engellenen yazarlar bu goruntuleyene gelmez.
      viewerId: viewer?.id ?? null,
    });
    return NextResponse.json({ items: page.items.map(toMobileReview), total: page.total, nextCursor: page.nextCursor });
  }

  const reviews = await reviewService.getShopReviews(id, viewer?.id ?? null);
  return NextResponse.json(reviews.map(toMobileReview));
}
