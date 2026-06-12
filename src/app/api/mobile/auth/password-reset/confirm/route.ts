import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import prisma from "@/lib/db";
import bcrypt from "bcryptjs";
import { PASSWORD_RESET_IDENTIFIER_PREFIX } from "@/lib/password-reset-token";

export async function POST(req: NextRequest) {
  const { token, password } = await req.json();

  if (!token || !password || password.length < 6) {
    return NextResponse.json({ error: "invalid_data" }, { status: 400 });
  }

  const vt = await prisma.verificationToken.findFirst({
    where: { token, expires: { gt: new Date() } },
  });

  if (!vt || !vt.identifier.startsWith(PASSWORD_RESET_IDENTIFIER_PREFIX)) {
    return NextResponse.json({ error: "invalid_or_expired_token" }, { status: 400 });
  }

  const email = vt.identifier.slice(PASSWORD_RESET_IDENTIFIER_PREFIX.length);
  const user = await prisma.user.findFirst({ where: { email } });
  if (!user) return NextResponse.json({ error: "user_not_found" }, { status: 404 });

  const hash = await bcrypt.hash(password, 12);
  await prisma.$transaction([
    prisma.user.update({ where: { id: user.id }, data: { passwordHash: hash, tokenVersion: { increment: 1 } } }),
    prisma.verificationToken.deleteMany({ where: { identifier: vt.identifier } }),
  ]);

  return NextResponse.json({ success: true });
}
