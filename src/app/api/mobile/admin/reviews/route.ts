import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { parseCursor, parseLimit } from "@/lib/cursor-page";
import { requireMobileUser, requireRole } from "@/lib/mobile-auth";
import { toMobileAdminReview } from "@/lib/mobile-dto";
import { parseAdminReviewFilter, reviewService } from "@/services/ReviewService";

/** Platformun son yorumlari (moderasyon kuyrugu): `?filter=all|low|hidden&cursor=&limit=`. */
export async function GET(req: NextRequest) {
  const auth = await requireMobileUser(req);
  if ("error" in auth) return auth.error;
  const forbid = requireRole(auth.user, ["ADMIN"]);
  if (forbid) return forbid;

  const sp = req.nextUrl.searchParams;
  const page = await reviewService.listForAdmin({
    filter: parseAdminReviewFilter(sp.get("filter")),
    cursor: parseCursor(sp.get("cursor")),
    take: parseLimit(sp.get("limit"), 20, 50),
  });
  return NextResponse.json({ items: page.items.map(toMobileAdminReview), total: page.total, nextCursor: page.nextCursor });
}
