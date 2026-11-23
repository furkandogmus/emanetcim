import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { forbidWhileImpersonating, requireMobileUser } from "@/lib/mobile-auth";
import { reviewService } from "@/services/ReviewService";

/** "Bu kullanicinin yorumlarini gizle". Govde web `blockReviewAuthorAction` ile ayni: `ReviewService.blockAuthor`. */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireMobileUser(req);
  if ("error" in auth) return auth.error;
  const blocked = forbidWhileImpersonating(auth.user);
  if (blocked) return blocked;

  const result = await reviewService.blockAuthor({ reviewId: (await params).id, viewerId: auth.user.id });
  if (!result.ok) {
    const status = result.reason === "not_found" ? 404 : result.reason === "rate_limited" ? 429 : 409;
    return NextResponse.json({ error: result.reason }, { status });
  }
  return NextResponse.json({ ok: true });
}
