import { NextResponse } from "next/server";
import { z } from "zod";
import prisma from "@/lib/db";
import { randomInt } from "crypto";
import logger from "@/lib/logger";
import { sendMobileOtp } from "@/lib/mail";
import { isNetgsmConfigured, normalizeTrGsm10, sendNetgsmRestSms } from "@/lib/netgsm";
import { rateLimit } from "@/lib/rate-limit";

const schema = z.union([
  z.object({ email: z.string().email() }),
  z.object({ phone: z.string().min(10) }),
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

  const ip = req.headers.get("x-forwarded-for") ?? "unknown";
  if (!(await rateLimit(`mobile_otp:${normalizedIdentity}`, 3, 2 * 60_000))) {
    return NextResponse.json({ error: "too_many_otp_requests" }, { status: 429 });
  }
  if (!(await rateLimit(`mobile_otp_ip:${ip}`, 10, 5 * 60_000))) {
    return NextResponse.json({ error: "too_many_requests" }, { status: 429 });
  }

  const code = String(randomInt(100000, 999999));
  const identifier = `mobile:${normalizedIdentity}`;

  await prisma.verificationToken.upsert({
    where: { identifier_token: { identifier, token: code } },
    update: { expires: new Date(Date.now() + 5 * 60_000) },
    create: {
      identifier,
      token: code,
      expires: new Date(Date.now() + 5 * 60_000),
    },
  });

  if (isEmail) {
    await sendMobileOtp(normalizedIdentity, code);
  } else {
    if (isNetgsmConfigured()) {
      const smsResult = await sendNetgsmRestSms({
        to10: normalizedIdentity,
        message: `BagajPark giris kodunuz: ${code}. Kod 5 dakika gecerlidir.`,
      });
      if (!smsResult.ok) {
        console.error(`[mobile-otp-sms-fail] ${normalizedIdentity} => ${smsResult.error}`);
      }
    } else {
      logger.warn({ phone: normalizedIdentity }, "mobile_otp_sms_skipped_no_netgsm");
    }
  }

  // Dev mode log
  if (process.env.NODE_ENV !== "production") {
    console.log(`[mobile-otp] ${normalizedIdentity} => ${code}`);
  }

  return NextResponse.json({ ok: true });
}
