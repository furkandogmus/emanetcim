import { NextResponse } from "next/server";
import { z } from "zod";
import { createRemoteJWKSet, jwtVerify } from "jose";
import prisma from "@/lib/db";
import { signAccessToken, signRefreshToken } from "@/lib/mobile-auth";

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
      if (email) {
        user = await prisma.user.findUnique({ where: { email } }) ?? undefined;
      }
      user ??= await prisma.user.create({
        data: { email, name: fullName, role: "GUEST", emailVerified: email ? new Date() : null },
      });
      await prisma.account.create({
        data: {
          userId: user.id,
          type: "oauth",
          provider: "apple",
          providerAccountId: appleSub,
        },
      });
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
