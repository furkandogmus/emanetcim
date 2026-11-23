import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { z } from "zod";
import { clientIpFromRequest } from "@/lib/client-ip";
import { forbidWhileImpersonating, requireMobileUser } from "@/lib/mobile-auth";
import { MAX_REPORT_NOTE, REVIEW_REPORT_REASONS, reviewService } from "@/services/ReviewService";

const BodySchema = z.object({
  reason: z.enum(REVIEW_REPORT_REASONS),
  note: z.string().max(MAX_REPORT_NOTE).optional(),
});

const STATUS = { not_found: 404, own_review: 409, duplicate: 409, rate_limited: 429 } as const;

/** Yorum bildir (App Review 1.2). Govde web `reportReviewAction` ile ayni: `ReviewService.report`. */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireMobileUser(req);
  if ("error" in auth) return auth.error;
  const blocked = forbidWhileImpersonating(auth.user);
  if (blocked) return blocked;

  const parsed = BodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "invalid_data" }, { status: 400 });

  const result = await reviewService.report({
    reviewId: (await params).id,
    reporterId: auth.user.id,
    reason: parsed.data.reason,
    note: parsed.data.note,
    ip: clientIpFromRequest(req),
  });
  if (!result.ok) return NextResponse.json({ error: result.reason }, { status: STATUS[result.reason] });
  return NextResponse.json({ ok: true, autoHidden: result.autoHidden });
}
