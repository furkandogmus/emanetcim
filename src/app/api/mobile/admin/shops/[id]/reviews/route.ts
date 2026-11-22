import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import prisma from "@/lib/db";
import { parseCursor, parseLimit } from "@/lib/cursor-page";
import { requireMobileUser, requireRole } from "@/lib/mobile-auth";
import { toMobileAdminReview } from "@/lib/mobile-dto";
import { parseAdminReviewFilter, reviewService } from "@/services/ReviewService";

/** Dukkanin yorumlari, gizlenenler dahil: `?filter=all|low|hidden&cursor=&limit=`. */
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireMobileUser(req);
  if ("error" in auth) return auth.error;
  const forbid = requireRole(auth.user, ["ADMIN"]);
  if (forbid) return forbid;

  const { id } = await params;
  const shop = await prisma.shop.findUnique({ where: { id }, select: { id: true } });
  if (!shop) return NextResponse.json({ error: "not_found" }, { status: 404 });

  const sp = req.nextUrl.searchParams;
  const page = await reviewService.listForAdmin({
    shopId: id,
    filter: parseAdminReviewFilter(sp.get("filter")),
    cursor: parseCursor(sp.get("cursor")),
    take: parseLimit(sp.get("limit"), 20, 50),
  });
  return NextResponse.json({ items: page.items.map(toMobileAdminReview), total: page.total, nextCursor: page.nextCursor });
}
