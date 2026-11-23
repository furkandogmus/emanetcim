import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { requireMobileUser, requireRole } from "@/lib/mobile-auth";
import { toMobileAdminPartnerLead } from "@/lib/mobile-dto";
import { leadConversionDraft, partnerLeadService } from "@/services/PartnerLeadService";

export const dynamic = "force-dynamic";

/** Mobil admin: esnaf on kayitlari (web `/admin/partner-leads` ile ayni liste). */
export async function GET(req: NextRequest) {
  const auth = await requireMobileUser(req);
  if ("error" in auth) return auth.error;
  const forbid = requireRole(auth.user, ["ADMIN"]);
  if (forbid) return forbid;

  const leads = await partnerLeadService.list();
  return NextResponse.json(leads.map((l) => toMobileAdminPartnerLead(l, leadConversionDraft(l))));
}
