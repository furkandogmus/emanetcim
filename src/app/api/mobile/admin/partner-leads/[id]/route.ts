import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { z } from "zod";
import { clientIpFromRequest } from "@/lib/client-ip";
import { forbidWhileImpersonating, requireMobileUser, requireRole } from "@/lib/mobile-auth";
import { revalidatePathAllLocales } from "@/lib/revalidate-locales";
import { partnerLeadService } from "@/services/PartnerLeadService";

const BodySchema = z.object({ contacted: z.boolean() }).strict();

/**
 * "Iletisime gecildi" / geri al (web `setPartnerLeadContactedAction` ile ayni govde:
 * `PartnerLeadService.setContacted`). Cevrilmis ya da olmayan kayit 404.
 */
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireMobileUser(req);
  if ("error" in auth) return auth.error;
  const blocked = forbidWhileImpersonating(auth.user);
  if (blocked) return blocked;
  const forbid = requireRole(auth.user, ["ADMIN"]);
  if (forbid) return forbid;

  const parsed = BodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "invalid_data" }, { status: 400 });

  const { id } = await params;
  const changed = await partnerLeadService.setContacted(id, parsed.data.contacted, {
    userId: auth.user.id,
    ip: clientIpFromRequest(req),
  });
  if (!changed) return NextResponse.json({ error: "not_found" }, { status: 404 });
  revalidatePathAllLocales("/admin/partner-leads");
  return NextResponse.json({ ok: true });
}
