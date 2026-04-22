import { NextResponse } from "next/server";
import { z } from "zod";
import prisma from "@/lib/db";
import { randomInt } from "crypto";

// TODO: production — rate limit + email send via Resend + Redis store
const schema = z.object({ email: z.string().email() });

export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "invalid" }, { status: 400 });

  const { email } = parsed.data;
  const code = String(randomInt(100000, 999999));

  await prisma.verificationToken.upsert({
    where: { identifier_token: { identifier: `mobile:${email}`, token: code } },
    update: { expires: new Date(Date.now() + 5 * 60_000) },
    create: {
      identifier: `mobile:${email}`,
      token: code,
      expires: new Date(Date.now() + 5 * 60_000),
    },
  });

  // TODO: send email. dev mode: log code.
  if (process.env.NODE_ENV !== "production") {
    console.log(`[mobile-otp] ${email} => ${code}`);
  }

  return NextResponse.json({ ok: true });
}
