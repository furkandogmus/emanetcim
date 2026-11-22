import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { z } from "zod";
import { clientIpFromRequest } from "@/lib/client-ip";
import { forbidWhileImpersonating, requireMobileUser, requireRole } from "@/lib/mobile-auth";
import { adminSetUserPassword } from "@/services/auth/admin-set-password";

const BodySchema = z.object({ password: z.string() }).strict();

const STATUS = { invalid_password: 400, not_found: 404, forbidden_target: 403 } as const;

/**
 * Yonetici sifre belirler (e-postasiz esnaf icin; web `AdminSetPasswordDialog`).
 * Kural ve denetim kaydi `adminSetUserPassword`ta; sifre yanitta da kayitta da yok.
 */
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
  const result = await adminSetUserPassword(id, parsed.data.password, {
    userId: auth.user.id,
    role: auth.user.role,
    ip: clientIpFromRequest(req),
  });
  if (!result.ok) return NextResponse.json({ error: result.reason }, { status: STATUS[result.reason] });
  return NextResponse.json({ ok: true });
}
