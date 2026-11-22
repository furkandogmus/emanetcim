import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { z } from "zod";
import { APP_LOCALES } from "@/i18n/locales";
import { clientIpFromRequest } from "@/lib/client-ip";
import { forbidWhileImpersonating, requireMobileUser, requireRole } from "@/lib/mobile-auth";
import { rateLimit } from "@/lib/rate-limit";
import { resolveRequestLocale } from "@/lib/request-locale";
import { adminUserService } from "@/services/AdminUserService";
import { adminMailErrorResponse } from "../admin-mail-errors";

const BodySchema = z.object({ locale: z.enum(APP_LOCALES).optional().catch(undefined) });

/**
 * Kullaniciya normal "sifremi unuttum" e-postasini (bag + 6 haneli kod) gonder.
 * Yonetici sifreyi ya da bagi gormez. Ayni hesaba saatte 5: e-posta yagmuru olmasin.
 */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireMobileUser(req);
  if ("error" in auth) return auth.error;
  const blocked = forbidWhileImpersonating(auth.user);
  if (blocked) return blocked;
  const forbid = requireRole(auth.user, ["ADMIN"]);
  if (forbid) return forbid;

  const parsed = BodySchema.safeParse((await req.json().catch(() => null)) ?? {});
  const locale = (parsed.success ? parsed.data.locale : undefined) ?? resolveRequestLocale(req.headers.get("accept-language"));

  const { id } = await params;
  if (!(await rateLimit(`admin-user-mail:reset:${id}`, 5, 60 * 60 * 1000))) {
    return NextResponse.json({ error: "too_many_requests" }, { status: 429 });
  }
  const result = await adminUserService.sendPasswordReset(id, { userId: auth.user.id, ip: clientIpFromRequest(req) }, locale);
  if (!result.ok) return adminMailErrorResponse(result.error);
  return NextResponse.json({ ok: true });
}
