import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { requireMobileUser } from "@/lib/mobile-auth";
import { toMobileAffiliatePanel } from "@/lib/mobile-dto";
import { getSiteBaseUrl } from "@/lib/site-base-url";
import { affiliateService } from "@/services/AffiliateService";

/** Aracinin kendi paneli; bagli araci kaydi yoksa `{ panel: null }`. Web `/account/affiliate` ile ayni servis. */
export async function GET(req: NextRequest) {
  const auth = await requireMobileUser(req);
  if ("error" in auth) return auth.error;
  const panel = await affiliateService.getPanelForUser(auth.user.id);
  if (!panel) return NextResponse.json({ panel: null });
  return NextResponse.json({ panel: toMobileAffiliatePanel(panel, `${getSiteBaseUrl()}/r/${panel.code}`) });
}
