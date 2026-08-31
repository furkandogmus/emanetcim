import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { z } from "zod";
import prisma from "@/lib/db";
import type { User } from "@prisma/client";
import { signAccessToken, signRefreshToken } from "@/lib/mobile-auth";
import { normalizeTrGsm10 } from "@/lib/netgsm";
import { rateLimit } from "@/lib/rate-limit";
import { clientIp } from "@/lib/internal-api-guard";
import { notificationService } from "@/services/NotificationService";
import { analyticsService } from "@/services/AnalyticsService";
import { resolveServerSessionId } from "@/lib/analytics-server";
import logger from "@/lib/logger";
import { toMobileUser } from "@/lib/mobile-dto";

const schema = z.union([
  z.object({ email: z.string().email(), code: z.string().length(6) }),
  z.object({ phone: z.string().min(10), code: z.string().length(6) }),
  z.object({ email: z.string().email(), password: z.string().min(1) }),
  z.object({ phone: z.string().min(10), password: z.string().min(1) }),
]);

type AuthRequestBody = {
  email?: string;
  phone?: string;
  code?: string;
  password?: string;
};

export async function POST(req: NextRequest) {
  /*
    IP KOVASI (2026-08-31). Asagidaki kovalar KIMLIK basinaydi: bir hesaba 15
    dakikada bes deneme. Bu, tek hesabi zorlamayi engelliyor ama SIFRE
    SERPMESINI (password spraying) hic engellemiyordu: saldirgan binlerce
    farkli e-postayi ayni tek sifreyle deneyince her istek AYRI kovaya
    dusuyordu ve toplam bir sinir yoktu. Depo acik kaynak oldugu icin uc
    adresleri ve govde semasi zaten herkese acik; sinirlamayi kodun gizliligi
    tasiyamaz.

    Iki kova birlikte: kimlik basina (tek hesabi zorlama) + IP basina (cok
    hesaba serpme).
  */
  const ip = clientIp(req);
  if (!(await rateLimit(`mobile_session:ip:${ip}`, 30, 15 * 60_000))) {
    return NextResponse.json({ error: "too_many_attempts" }, { status: 429 });
  }

  const body = await req.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid_input" }, { status: 400 });
  }

  const data = parsed.data as AuthRequestBody;
  const isEmail = "email" in data;
  const rawIdentity = isEmail ? data.email : data.phone;
  const normalizedIdentity = isEmail ? rawIdentity!.toLowerCase() : normalizeTrGsm10(rawIdentity!);

  if (!normalizedIdentity) {
    return NextResponse.json({ error: "invalid_format" }, { status: 400 });
  }

  const { code, password } = data;
  const identifier = `mobile:${normalizedIdentity}`;

  let user: User | null = null;

  if (code) {
    if (!(await rateLimit(`mobile_otp_verify:${normalizedIdentity}`, 5, 15 * 60_000))) {
      return NextResponse.json({ error: "too_many_attempts" }, { status: 429 });
    }

    const token = await prisma.verificationToken.delete({
      where: { identifier_token: { identifier, token: code } },
    }).catch(() => null);

    if (!token || token.expires < new Date()) {
      return NextResponse.json({ error: "invalid_code" }, { status: 401 });
    }

    user = isEmail
      ? await prisma.user.findUnique({ where: { email: normalizedIdentity } })
      : await prisma.user.findFirst({
          where: {
            OR: [
              { phone: normalizedIdentity },
              { phone: `+90${normalizedIdentity}` },
              { phone: `0${normalizedIdentity}` }
            ]
          }
        });

    if (!user) {
      user = await prisma.user.create({
        data: {
          email: isEmail ? normalizedIdentity : null,
          phone: !isEmail ? normalizedIdentity : null,
          role: "GUEST",
          name: isEmail ? normalizedIdentity.split("@")[0] : `User ${normalizedIdentity.slice(-4)}`,
        },
      });
      const newUserId = user.id;
      void notificationService
        .notifyAdminsForNewUser({
          name: user.name,
          email: user.email,
          phone: user.phone,
          role: "GUEST",
          source: "mobile_otp",
        })
        .catch((err) => logger.error({ err, userId: newUserId }, "notify_admins_new_guest_failed"));
      analyticsService.track({
        name: "user_signed_up",
        sessionId: await resolveServerSessionId(newUserId),
        userId: newUserId,
        metadata: { source: "mobile_otp", role: "GUEST" },
      });
    }
  } else if (password) {
    if (!(await rateLimit(`mobile_pwd:${normalizedIdentity}`, 5, 15 * 60_000))) {
      return NextResponse.json({ error: "too_many_attempts" }, { status: 429 });
    }

    user = isEmail
      ? await prisma.user.findUnique({ where: { email: normalizedIdentity } })
      : await prisma.user.findFirst({
          where: {
            OR: [
              { phone: normalizedIdentity },
              { phone: `+90${normalizedIdentity}` },
              { phone: `0${normalizedIdentity}` }
            ]
          }
        });

    if (!user || !user.passwordHash) {
      return NextResponse.json({ error: "invalid_credentials" }, { status: 401 });
    }

    const { verifyPassword } = await import("@/lib/auth-password");
    const isValid = await verifyPassword(password, user.passwordHash);
    if (!isValid) {
      return NextResponse.json({ error: "invalid_credentials" }, { status: 401 });
    }
  } else {
    return NextResponse.json({ error: "invalid_input" }, { status: 400 });
  }

  const access = await signAccessToken(user.id, user.role, user.tokenVersion);
  const refresh = await signRefreshToken(user.id, user.role, user.tokenVersion);

  return NextResponse.json({
    accessToken: access,
    refreshToken: refresh,
    user: toMobileUser(user),
  });
}
