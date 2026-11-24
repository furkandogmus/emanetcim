import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { APP_LOCALES, DEFAULT_APP_LOCALE } from "@/i18n/locales";
import { teamGate } from "@/lib/mobile-shop-team";
import { toMobileShopTeam } from "@/lib/mobile-dto";
import { inviteStaff, listTeam, type InviteResult } from "@/services/ShopStaffService";

/** GET: ekip listesi + bekleyen davetler. Yalniz sahip/yonetici (`manage`). */
export async function GET(req: NextRequest) {
  const gate = await teamGate(req, { write: false });
  if ("error" in gate) return gate.error;
  return NextResponse.json(toMobileShopTeam(gate.shop, await listTeam(gate.shop.id)));
}

const INVITE_HTTP: Record<Exclude<InviteResult, { ok: true }>["code"], number> = {
  INVALID_EMAIL: 400,
  SELF: 400,
  OWNER: 400,
  ALREADY_MEMBER: 409,
  LIMIT: 409,
  RATE_LIMITED: 429,
  NOT_FOUND: 404,
};

/** POST `{ email, locale? }`: hesap varsa dogrudan ekler, yoksa davet bagi gonderir. */
export async function POST(req: NextRequest) {
  const gate = await teamGate(req, { write: true });
  if ("error" in gate) return gate.error;
  const body = (await req.json().catch(() => null)) as { email?: unknown; locale?: unknown } | null;
  const asked = typeof body?.locale === "string" ? body.locale : "";
  const locale = (APP_LOCALES as readonly string[]).includes(asked) ? asked : DEFAULT_APP_LOCALE;
  const result = await inviteStaff({ actor: gate.user, shopId: gate.shop.id, email: body?.email, locale });
  if (!result.ok) {
    return NextResponse.json({ error: result.code.toLowerCase() }, { status: INVITE_HTTP[result.code] });
  }
  return NextResponse.json({ success: true, kind: result.kind });
}
