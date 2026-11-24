import { NextResponse } from "next/server";
import { z } from "zod";
import prisma from "@/lib/db";
import logger from "@/lib/logger";
import { sendMobileOtp } from "@/lib/mail";
import { isNetgsmConfigured, normalizeTrGsm10, sendNetgsmRestSms } from "@/lib/netgsm";
import { rateLimit } from "@/lib/rate-limit";
import { clientIpFromHeaders } from "@/lib/client-ip";
import { resolveRequestLocale } from "@/lib/request-locale";
import { isBlockedSignupEmail } from "@/lib/disposable-emails";
import { smsLoginEnabled } from "@/lib/sms-login";
import { issueMobileLoginCode } from "@/services/auth/mobile-login-code";

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

  /*
    SMS YOK: eski surumler telefon gonderebilir (parse hatasi yerine acik kod
    donsun diye sema telefonu hala kabul ediyor) ama hicbir kod saklanmaz.
  */
  if (!isEmail && !smsLoginEnabled()) {
    logger.warn("mobile_otp_phone_rejected_sms_disabled");
    return NextResponse.json({ error: "sms_unavailable" }, { status: 400 });
  }
  const rawIdentity = isEmail ? data.email : data.phone;
  const normalizedIdentity = isEmail ? rawIdentity.toLowerCase() : normalizeTrGsm10(rawIdentity);

  if (!normalizedIdentity) {
    return NextResponse.json({ error: "invalid_format" }, { status: 400 });
  }

  const ip = clientIpFromHeaders(req.headers);
  if (!(await rateLimit(`mobile_otp:${normalizedIdentity}`, 3, 2 * 60_000))) {
    return NextResponse.json({ error: "too_many_otp_requests" }, { status: 429 });
  }
  if (!(await rateLimit(`mobile_otp_ip:${ip}`, 10, 5 * 60_000))) {
    return NextResponse.json({ error: "too_many_requests" }, { status: 429 });
  }

  /*
    Bot kalibi / gecici domain yeni hesap acamaz (session ucu da reddeder). Kod
    yazildiktan SONRA degil, mail gitmeden once soyle: kullanici bos yere
    bekletilmez. Yalnizca engelli kalipta olan ve hesabi bulunmayan adres icin.
  */
  if (isEmail && isBlockedSignupEmail(normalizedIdentity)) {
    const existing = await prisma.user.findUnique({
      where: { email: normalizedIdentity },
      select: { id: true },
    });
    if (!existing) {
      return NextResponse.json({ error: "invalid_email" }, { status: 403 });
    }
  }

  // Tek aktif kod, hash'li saklama, ADMIN reddi ve Play inceleme kodu: `mobile-login-code.ts`.
  const issued = await issueMobileLoginCode(normalizedIdentity, isEmail ? "email" : "phone");
  /*
    Gonderim atesle-unut, her yolda: beklenirse SMTP/SMS gidis-donusu ve
    gonderim hatasi (500) yalnizca normal hesaplarda gorunur, ADMIN ve inceleme
    hesabi hemen 200 donerdi; sure ve durum kodu rolu sizdirirdi.
  */
  if (issued.kind === "deliver") {
    const { code } = issued;
    void deliverCode(isEmail, normalizedIdentity, code, resolveRequestLocale(req.headers.get("accept-language"))).catch(
      (err) => logger.error({ err }, "mobile_otp_delivery_failed"),
    );
    if (process.env.NODE_ENV !== "production") {
      console.log(`[mobile-otp] ${normalizedIdentity} => ${code}`);
    }
  }

  return NextResponse.json({ ok: true });
}

async function deliverCode(isEmail: boolean, identity: string, code: string, locale: string): Promise<void> {
  if (isEmail) {
    await sendMobileOtp(identity, code, locale);
    return;
  }
  if (!isNetgsmConfigured()) {
    logger.warn({ phone: identity }, "mobile_otp_sms_skipped_no_netgsm");
    return;
  }
  const smsResult = await sendNetgsmRestSms({
    to10: identity,
    message: `BagajPark giris kodunuz: ${code}. Kod 5 dakika gecerlidir.`,
  });
  if (!smsResult.ok) logger.error({ error: smsResult.error }, "mobile_otp_sms_failed");
}
