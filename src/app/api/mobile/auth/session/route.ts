import { NextResponse } from "next/server";
import { z } from "zod";
import prisma from "@/lib/db";
import { signAccessToken, signRefreshToken } from "@/lib/mobile-auth";

const schema = z.object({ email: z.string().email(), code: z.string().length(6) });

export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "invalid" }, { status: 400 });

  const { email, code } = parsed.data;
  const identifier = `mobile:${email}`;

  const token = await prisma.verificationToken.findUnique({
    where: { identifier_token: { identifier, token: code } },
  });
  if (!token || token.expires < new Date()) {
    return NextResponse.json({ error: "invalid_code" }, { status: 401 });
  }
  await prisma.verificationToken.delete({ where: { identifier_token: { identifier, token: code } } });

  let user = await prisma.user.findUnique({ where: { email } });
  user ??= await prisma.user.create({ data: { email, role: "GUEST" } });

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
