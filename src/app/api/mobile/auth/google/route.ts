import { NextResponse } from "next/server";
import { z } from "zod";
import { createRemoteJWKSet, jwtVerify } from "jose";
import prisma from "@/lib/db";
import { signAccessToken, signRefreshToken } from "@/lib/mobile-auth";
import { rateLimit } from "@/lib/rate-limit";
import { notificationService } from "@/services/NotificationService";
import logger from "@/lib/logger";

const GOOGLE_JWKS = createRemoteJWKSet(new URL("https://www.googleapis.com/oauth2/v3/certs"));

const schema = z.object({ idToken: z.string() });

export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "invalid" }, { status: 400 });

  if (!(await rateLimit(`mobile_google_auth`, 10, 60_000))) {
    return NextResponse.json({ error: "too_many_attempts" }, { status: 429 });
  }

  const iosClientId = process.env.GOOGLE_IOS_CLIENT_ID;
  const androidClientId = process.env.GOOGLE_ANDROID_CLIENT_ID;
  const webClientId = process.env.GOOGLE_CLIENT_ID;
  const allowed = [iosClientId, androidClientId, webClientId].filter(Boolean) as string[];

  try {
    const { payload } = await jwtVerify(parsed.data.idToken, GOOGLE_JWKS, {
      issuer: ["https://accounts.google.com", "accounts.google.com"],
      audience: allowed.length > 0 ? allowed : undefined,
    });

    const email = typeof payload.email === "string" ? payload.email.toLowerCase() : null;
    if (!email || payload.email_verified !== true) {
      return NextResponse.json({ error: "email_not_verified" }, { status: 401 });
    }
    const name = typeof payload.name === "string" ? payload.name : null;
    const picture = typeof payload.picture === "string" ? payload.picture : null;

    let user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
      user = await prisma.user.create({
        data: { email, name, image: picture, role: "GUEST", emailVerified: new Date() },
      });
      const newUserId = user.id;
      void notificationService
        .notifyAdminsForNewUser({
          name: user.name,
          email: user.email,
          phone: user.phone,
          role: "GUEST",
          source: "mobile_google",
        })
        .catch((err) => logger.error({ err, userId: newUserId }, "notify_admins_new_guest_failed"));
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
