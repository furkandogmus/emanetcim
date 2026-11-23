import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { z } from "zod";
import { clientIpFromRequest } from "@/lib/client-ip";
import { forbidWhileImpersonating, requireMobileUser } from "@/lib/mobile-auth";
import { toMobileDeletionRequest } from "@/lib/mobile-dto";
import { ACCOUNT_DELETION_SLA_DAYS, accountPrivacyService, DELETION_NOTE_MAX } from "@/services/AccountPrivacyService";

const BodySchema = z.object({
  note: z.string().max(DELETION_NOTE_MAX).optional(),
  locale: z.string().max(8).optional(),
});

/** Esnaf/yonetici silme talebinin durumu. */
export async function GET(req: NextRequest) {
  const auth = await requireMobileUser(req);
  if ("error" in auth) return auth.error;
  const r = await accountPrivacyService.getDeletionRequest(auth.user.id);
  return NextResponse.json(toMobileDeletionRequest(r, ACCOUNT_DELETION_SLA_DAYS));
}

/** Esnaf/yonetici hesap silme talebi. Govde web `requestAccountDeletionAction` ile ayni servis. */
export async function POST(req: NextRequest) {
  const auth = await requireMobileUser(req);
  if ("error" in auth) return auth.error;
  const blocked = forbidWhileImpersonating(auth.user);
  if (blocked) return blocked;

  const parsed = BodySchema.safeParse((await req.json().catch(() => ({}))) ?? {});
  if (!parsed.success) return NextResponse.json({ error: "invalid_data" }, { status: 400 });

  const result = await accountPrivacyService.requestDeletion({
    userId: auth.user.id,
    role: auth.user.role,
    ip: clientIpFromRequest(req),
    note: parsed.data.note,
    locale: parsed.data.locale,
    auditAction: "account.deletion_requested_mobile",
  });
  if (!result.ok) {
    const status = result.reason === "not_found" ? 404 : 409;
    return NextResponse.json({ error: result.reason }, { status });
  }
  const r = await accountPrivacyService.getDeletionRequest(auth.user.id);
  return NextResponse.json({ ...toMobileDeletionRequest(r, result.slaDays), alreadyPending: result.alreadyPending });
}
