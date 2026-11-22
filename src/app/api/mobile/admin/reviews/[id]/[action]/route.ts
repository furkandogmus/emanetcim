import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { z } from "zod";
import { clientIpFromRequest } from "@/lib/client-ip";
import { forbidWhileImpersonating, requireMobileUser, requireRole } from "@/lib/mobile-auth";
import { MAX_MODERATION_REASON, reviewService } from "@/services/ReviewService";
import { revalidateShopContent } from "../../../shops/[id]/revalidate";

/*
  Yorum moderasyonu: `POST /admin/reviews/:id/hide|unhide|delete`, govde
  `{ reason }`. Govde web `deleteReviewAction` ile ayni (`ReviewService.moderate`):
  yazma, dukkan ortalamasinin yeniden hesabi ve denetim kaydi orada.

  Gerekce mobilde gizleme VE silmede zorunlu: silme geri alinamaz ve izi
  yalnizca denetim kaydinda kalir. Geri almada istenmez.
*/
const ACTIONS = ["hide", "unhide", "delete"] as const;
const BodySchema = z.object({ reason: z.string().trim().max(MAX_MODERATION_REASON).optional() });
const MIN_REASON = 3;

const STATUS = { not_found: 404, already_hidden: 409, not_hidden: 409, reason_required: 400 } as const;

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string; action: string }> }) {
  const auth = await requireMobileUser(req);
  if ("error" in auth) return auth.error;
  const forbid = requireRole(auth.user, ["ADMIN"]) ?? forbidWhileImpersonating(auth.user);
  if (forbid) return forbid;

  const { id, action } = await params;
  const act = ACTIONS.find((a) => a === action);
  if (!act) return NextResponse.json({ error: "invalid_action" }, { status: 400 });

  const parsed = BodySchema.safeParse((await req.json().catch(() => null)) ?? {});
  if (!parsed.success) return NextResponse.json({ error: "invalid_data" }, { status: 400 });
  const reason = parsed.data.reason ?? "";
  if (act !== "unhide" && reason.length < MIN_REASON) {
    return NextResponse.json({ error: "reason_required" }, { status: 400 });
  }

  const result = await reviewService.moderate({
    reviewId: id,
    action: act,
    reason: act === "unhide" ? null : reason,
    actor: { id: auth.user.id, ip: clientIpFromRequest(req) },
  });
  if (!result.ok) return NextResponse.json({ error: result.reason }, { status: STATUS[result.reason] });
  revalidateShopContent(result.shopId);
  return NextResponse.json({ ok: true });
}
