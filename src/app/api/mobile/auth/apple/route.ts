import { NextResponse } from "next/server";
import { z } from "zod";
import { createRemoteJWKSet, jwtVerify } from "jose";
import prisma from "@/lib/db";
import { signAccessToken, signRefreshToken } from "@/lib/mobile-auth";
import { rateLimit } from "@/lib/rate-limit";
import { notificationService } from "@/services/NotificationService";
import { analyticsService } from "@/services/AnalyticsService";
import { resolveServerSessionId } from "@/lib/analytics-server";
import logger from "@/lib/logger";

const APPLE_JWKS = createRemoteJWKSet(new URL("https://appleid.apple.com/auth/keys"));

const schema = z.object({
  identityToken: z.string(),
  givenName: z.string().optional(),
  familyName: z.string().optional(),
});

export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "invalid" }, { status: 400 });

  const audience = process.env.APPLE_BUNDLE_ID; // e.g. com.bagajpark.mobile
  if (!audience) return NextResponse.json({ error: "apple_not_configured" }, { status: 500 });

  if (!(await rateLimit(`mobile_apple_auth`, 10, 60_000))) {
    return NextResponse.json({ error: "too_many_attempts" }, { status: 429 });
  }

  try {
    const { payload } = await jwtVerify(parsed.data.identityToken, APPLE_JWKS, {
      issuer: "https://appleid.apple.com",
      audience,
    });

    const appleSub = typeof payload.sub === "string" ? payload.sub : null;
    const email = typeof payload.email === "string" ? payload.email.toLowerCase() : null;
    if (!appleSub) return NextResponse.json({ error: "invalid_token" }, { status: 401 });

    // Apple'da ilk girişte email gelir, sonraki girişlerde gelmez → sub ile bul.
    const account = await prisma.account.findFirst({
      where: { provider: "apple", providerAccountId: appleSub },
      include: { user: true },
    });

    let user = account?.user;
    if (!user) {
      const fullName = [parsed.data.givenName, parsed.data.familyName].filter(Boolean).join(" ") || null;
      // Apple sign-in mevcut bir e-postaya bağlanıyor olabilir (yeni yöntem
      // eklemek) — bu durumda "yeni kullanıcı" bildirimi YANLIŞ olur; yalnızca
      // gerçekten yeni bir hesap yaratılınca gönderilmeli.
      const existedBefore = email ? !!(await prisma.user.findUnique({ where: { email } })) : false;
      if (email) {
        user = await prisma.user.upsert({
          where: { email },
          update: { name: fullName, emailVerified: email ? new Date() : null },
          create: { email, name: fullName, role: "GUEST", emailVerified: email ? new Date() : null },
        });
      } else {
        user = await prisma.user.create({
          data: { email: null, name: fullName, role: "GUEST" },
        });
      }
      if (!existedBefore) {
        const newUserId = user.id;
        void notificationService
          .notifyAdminsForNewUser({
            name: user.name,
            email: user.email,
            phone: user.phone,
            role: "GUEST",
            source: "mobile_apple",
          })
          .catch((err) => logger.error({ err, userId: newUserId }, "notify_admins_new_guest_failed"));
        analyticsService.track({
          name: "user_signed_up",
          sessionId: await resolveServerSessionId(newUserId),
          userId: newUserId,
          metadata: { source: "mobile_apple", role: "GUEST" },
        });
      }
      await prisma.account.create({
        data: {
          userId: user.id,
          type: "oauth",
          provider: "apple",
          providerAccountId: appleSub,
        },
      });
    }

    if (user.isBanned) {
      return NextResponse.json({ error: "account_banned" }, { status: 403 });
    }

    const access = await signAccessToken(user.id, user.role);
    const refresh = await signRefreshToken(user.id, user.role);
    return NextResponse.json({
      accessToken: access,
      refreshToken: refresh,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        phone: user.phone,
        role: user.role,
        avatarUrl: user.image,
      },
    });
  } catch {
    return NextResponse.json({ error: "invalid_token" }, { status: 401 });
  }
}
