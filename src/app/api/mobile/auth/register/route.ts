import { NextResponse } from "next/server";
import { z } from "zod";
import prisma from "@/lib/db";
import { signAccessToken, signRefreshToken } from "@/lib/mobile-auth";
import { hashPassword } from "@/lib/auth-password";
import { normalizeTrGsm10 } from "@/lib/netgsm";
import { rateLimit } from "@/lib/rate-limit";
import { notificationService } from "@/services/NotificationService";
import { analyticsService } from "@/services/AnalyticsService";
import { resolveServerSessionId } from "@/lib/analytics-server";
import logger from "@/lib/logger";
import { toMobileUser } from "@/lib/mobile-dto";

const schema = z.object({
  email: z.string().email().optional().or(z.literal("")),
  phone: z.string().min(10).optional().or(z.literal("")),
  password: z.string().min(6),
  name: z.string().min(1).max(100).optional(),
}).refine((d) => d.email || d.phone, { message: "email or phone required" });

export async function POST(req: Request) {
  if (!(await rateLimit(`register`, 5, 60_000))) {
    return NextResponse.json({ error: "too_many_attempts" }, { status: 429 });
  }

  const body = await req.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid_input" }, { status: 400 });
  }

  const { email, password, name } = parsed.data;
  const phone = parsed.data.phone ? normalizeTrGsm10(parsed.data.phone) ?? undefined : undefined;
  if (!phone && !email) {
    return NextResponse.json({ error: "invalid_input" }, { status: 400 });
  }

  const normalizedEmail = email ? email.toLowerCase().trim() : null;

  const existing = normalizedEmail
    ? await prisma.user.findUnique({ where: { email: normalizedEmail } })
    : phone
      ? await prisma.user.findFirst({
          where: {
            OR: [
              { phone },
              { phone: `+90${phone}` },
              { phone: `0${phone}` }
            ]
          }
        })
      : null;

  if (existing) {
    // Hesap zaten var → giriş yap (şifre doğruysa)
    if (existing.passwordHash) {
      const { verifyPassword } = await import("@/lib/auth-password");
      const valid = await verifyPassword(password, existing.passwordHash);
      if (!valid) {
        return NextResponse.json({ error: "invalid_credentials" }, { status: 401 });
      }
    }
    const access = await signAccessToken(existing.id, existing.role);
    const refresh = await signRefreshToken(existing.id, existing.role);
    return NextResponse.json({
      accessToken: access,
      refreshToken: refresh,
      user: toMobileUser(existing),
    });
  }

  const passwordHash = await hashPassword(password);
  const user = await prisma.user.create({
    data: {
      email: normalizedEmail,
      phone: phone || null,
      name: name || normalizedEmail?.split("@")[0] || `User${phone?.slice(-4)}`,
      passwordHash,
      role: "GUEST",
      emailVerified: normalizedEmail ? new Date() : null,
    },
  });

  void notificationService
    .notifyAdminsForNewUser({
      name: user.name,
      email: user.email,
      phone: user.phone,
      role: "GUEST",
      source: "mobile_register",
    })
    .catch((err) => logger.error({ err, userId: user.id }, "notify_admins_new_guest_failed"));

  analyticsService.track({
    name: "user_signed_up",
    sessionId: await resolveServerSessionId(user.id),
    userId: user.id,
    metadata: { source: "mobile_register", role: "GUEST" },
  });

  const access = await signAccessToken(user.id, user.role);
  const refresh = await signRefreshToken(user.id, user.role);

  return NextResponse.json({
    accessToken: access,
    refreshToken: refresh,
    user: toMobileUser(user),
  });
}
