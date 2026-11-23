import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { z } from "zod";
import { clientIpFromRequest } from "@/lib/client-ip";
import { forbidWhileImpersonating, requireMobileUser, requireRole } from "@/lib/mobile-auth";
import { toMobileLeadConversion } from "@/lib/mobile-dto";
import logger from "@/lib/logger";
import { revalidatePathAllLocales } from "@/lib/revalidate-locales";
import { partnerLeadService, type LeadConversionFailure } from "@/services/PartnerLeadService";

// Bos alan = on kayittaki deger; dogrulama servisin (web ile ayni kural).
const BodySchema = z.object({
  ownerName: z.string().trim().max(120).optional(),
  phone: z.string().trim().max(20).optional(),
  email: z.string().trim().max(200).optional(),
  shopName: z.string().trim().max(200).optional(),
  shopAddress: z.string().trim().max(500).optional(),
  city: z.string().trim().max(100).optional(),
  district: z.string().trim().max(100).optional(),
  location: z.string().trim().max(2000),
  activate: z.boolean().optional(),
}).strict();

const STATUS: Record<LeadConversionFailure, number> = {
  not_found: 404,
  invalid_data: 400,
  invalid_email: 400,
  location_required: 400,
  invalid_tr_phone: 400,
  phone_already_registered: 409,
  email_already_registered: 409,
};

/** Mobil admin: on kaydi esnaf hesabi + dukkana cevirir. Govde `PartnerLeadService.convertToPartner`. */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireMobileUser(req);
  if ("error" in auth) return auth.error;
  const blocked = forbidWhileImpersonating(auth.user);
  if (blocked) return blocked;
  const forbid = requireRole(auth.user, ["ADMIN"]);
  if (forbid) return forbid;

  const parsed = BodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "invalid_data" }, { status: 400 });

  const { id } = await params;
  const result = await partnerLeadService.convertToPartner({
    leadId: id,
    ...parsed.data,
    actor: { userId: auth.user.id, ip: clientIpFromRequest(req) },
  });
  if (!result.ok) return NextResponse.json({ error: result.reason }, { status: STATUS[result.reason] });

  try {
    revalidatePathAllLocales("/admin/partner-leads");
    revalidatePathAllLocales("/admin/partners");
    revalidatePathAllLocales("/admin/applications");
  } catch (err) {
    logger.error({ leadId: id, err }, "revalidate_after_lead_convert_failed");
  }
  return NextResponse.json(toMobileLeadConversion(result));
}
