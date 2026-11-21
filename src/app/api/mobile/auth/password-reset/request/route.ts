import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { z } from "zod";
import prisma from "@/lib/db";
import { rateLimit } from "@/lib/rate-limit";
import { clientIpFromRequest } from "@/lib/client-ip";
import { sendPasswordResetEmail } from "@/lib/mail";
import { generatePasswordResetToken } from "@/lib/password-reset-token";
import { APP_LOCALES } from "@/i18n/locales";
import { resolveRequestLocale } from "@/lib/request-locale";

const schema = z.object({
  email: z.string().trim().email().max(320),
  // Tanimsiz dil istegi dusurmez (sessizce mail gitmezdi): Accept-Language'e duser.
  locale: z.enum(APP_LOCALES).optional().catch(undefined),
});

/**
 * Mobile parity for the web requestPasswordResetAction. Always returns
 * { ok: true } so callers cannot enumerate accounts via response timing
 * or status. Real send only happens for accounts with an existing
 * passwordHash. Reset link in the email points at the web flow at
 * /{locale}/auth/new-password?token=...
 */
export async function POST(req: NextRequest) {
  const ip = clientIpFromRequest(req);
  if (!(await rateLimit(`forgot-password:ip:${ip}`, 10, 15 * 60 * 1000))) {
    return NextResponse.json({ ok: true });
  }

  const body = await req.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ ok: true });
  }

  const email = parsed.data.email.toLowerCase();
  // Istemci dil gondermediyse Accept-Language'den (eskiden hep Turkce).
  const locale = parsed.data.locale ?? resolveRequestLocale(req.headers.get("accept-language"));

  if (!(await rateLimit(`forgot-password:email:${email}`, 5, 60 * 60 * 1000))) {
    return NextResponse.json({ ok: true });
  }

  const user = await prisma.user.findUnique({
    where: { email },
    select: { id: true, email: true },
  });

  if (!user?.email) {
    return NextResponse.json({ ok: true });
  }

  const row = await generatePasswordResetToken(user.email);
  await sendPasswordResetEmail(user.email, row.token, locale);

  return NextResponse.json({ ok: true });
}
