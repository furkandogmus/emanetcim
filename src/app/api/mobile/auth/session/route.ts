import { NextResponse } from "next/server";
import { z } from "zod";
import prisma from "@/lib/db";
import { signAccessToken, signRefreshToken } from "@/lib/mobile-auth";
import { normalizeTrGsm10 } from "@/lib/netgsm";

const schema = z.union([
  z.object({ email: z.string().email(), code: z.string().length(6) }),
  z.object({ phone: z.string().min(10), code: z.string().length(6) }),
]);

export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid_input" }, { status: 400 });
  }

  const data = parsed.data;
  const isEmail = "email" in data;
  const rawIdentity = isEmail ? data.email : data.phone;
  const normalizedIdentity = isEmail ? rawIdentity.toLowerCase() : normalizeTrGsm10(rawIdentity);

  if (!normalizedIdentity) {
    return NextResponse.json({ error: "invalid_format" }, { status: 400 });
  }

  const { code } = data;
  const identifier = `mobile:${normalizedIdentity}`;

  const token = await prisma.verificationToken.findUnique({
    where: { identifier_token: { identifier, token: code } },
  });

  if (!token || token.expires < new Date()) {
    return NextResponse.json({ error: "invalid_code" }, { status: 401 });
  }

  await prisma.verificationToken.delete({
    where: { identifier_token: { identifier, token: code } },
  });

  // Find or create user
  let user = isEmail
    ? await prisma.user.findUnique({ where: { email: normalizedIdentity } })
    : await prisma.user.findUnique({ where: { phone: normalizedIdentity } });

  if (!user) {
    user = await prisma.user.create({
      data: {
        email: isEmail ? normalizedIdentity : null,
        phone: !isEmail ? normalizedIdentity : null,
        role: "GUEST",
        name: isEmail ? normalizedIdentity.split("@")[0] : `User ${normalizedIdentity.slice(-4)}`,
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
}
