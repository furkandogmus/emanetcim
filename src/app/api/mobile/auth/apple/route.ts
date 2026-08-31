import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { z } from "zod";
import { createRemoteJWKSet, jwtVerify } from "jose";
import prisma from "@/lib/db";
import { signAccessToken, signRefreshToken } from "@/lib/mobile-auth";
import { rateLimit } from "@/lib/rate-limit";
import { clientIp } from "@/lib/internal-api-guard";
import { notificationService } from "@/services/NotificationService";
import { analyticsService } from "@/services/AnalyticsService";
import { resolveServerSessionId } from "@/lib/analytics-server";
import logger from "@/lib/logger";
import { toMobileUser } from "@/lib/mobile-dto";

const APPLE_JWKS = createRemoteJWKSet(new URL("https://appleid.apple.com/auth/keys"));

const schema = z.object({
  identityToken: z.string(),
  givenName: z.string().optional(),
  familyName: z.string().optional(),
});

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "invalid" }, { status: 400 });

  const audience = process.env.APPLE_BUNDLE_ID; // e.g. com.bagajpark.mobile
  if (!audience) return NextResponse.json({ error: "apple_not_configured" }, { status: 500 });

  /*
    KOVA ANAHTARI IP BASINA (2026-08-31): sabit `mobile_apple_auth` anahtari TEK
    bir kovada tum kullanicilari sayiyordu. Dakikada on istek atan biri Apple
    ile girisi HERKES icin kapatiyordu -- hiz siniri degil, bedava hizmet disi
    birakma dugmesi.
  */
  const ip = clientIp(req);
  if (!(await rateLimit(`mobile_apple_auth:ip:${ip}`, 10, 60_000))) {
    return NextResponse.json({ error: "too_many_attempts" }, { status: 429 });
  }

  try {
    const { payload } = await jwtVerify(parsed.data.identityToken, APPLE_JWKS, {
      issuer: "https://appleid.apple.com",
      audience,
    });

    const appleSub = typeof payload.sub === "string" ? payload.sub : null;
    if (!appleSub) return NextResponse.json({ error: "invalid_token" }, { status: 401 });

    /*
      HESAP DEVRALMA (2026-08-31'de bulundu).

      Asagida, apple `sub`'i bilinmiyorsa ve token'da e-posta varsa
      `user.upsert({ where: { email } })` calisiyor: yani token'daki e-posta
      MEVCUT bir hesaba denk gelirse Apple kimligi O HESABA baglaniyor ve
      hesabin token'lari veriliyor.

      Apple, `email_verified` alanini `true` ya da `false` degeri (bazen
      string, bazen boolean) olarak gonderir; dogrulanmamis olabilir. Google
      ucu bunu bastan beri kontrol ediyordu (`email_verified !== true`), Apple
      ucu HIC kontrol etmiyordu. Dogrulanmamis bir e-postayla acilmis bir
      Apple ID, o adrese ait BagajPark hesabini devralmaya yetiyordu.

      Kural: e-postayi yalnizca Apple dogrulanmis dediginde KIMLIK olarak
      kullaniriz. Dogrulanmamissa hesap `sub` uzerinden acilir; e-posta
      yazilmaz. Boylece dogrulanmamis bir adres asla mevcut bir hesaba
      baglanamaz.
    */
    const emailVerifiedClaim = payload.email_verified;
    const appleEmailVerified =
      emailVerifiedClaim === true || emailVerifiedClaim === "true";
    const rawEmail = typeof payload.email === "string" ? payload.email.toLowerCase() : null;
    const email = appleEmailVerified ? rawEmail : null;

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
      user: toMobileUser(user),
    });
  } catch {
    return NextResponse.json({ error: "invalid_token" }, { status: 401 });
  }
}
