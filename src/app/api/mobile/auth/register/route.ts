import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { z } from "zod";
import prisma from "@/lib/db";
import { signAccessToken, signRefreshToken } from "@/lib/mobile-auth";
import { hashPassword } from "@/lib/auth-password";
import { normalizeTrGsm10 } from "@/lib/netgsm";
import { rateLimit } from "@/lib/rate-limit";
import { clientIp } from "@/lib/internal-api-guard";
import { notificationService } from "@/services/NotificationService";
import { analyticsService } from "@/services/AnalyticsService";
import { resolveServerSessionId } from "@/lib/analytics-server";
import logger from "@/lib/logger";
import { toMobileUser } from "@/lib/mobile-dto";

const schema = z.object({
  email: z.string().email().optional().or(z.literal("")),
  phone: z.string().min(10).optional().or(z.literal("")),
  password: z.string().min(6),
  name: z.string().min(1).max(100).optional(),
}).refine((d) => d.email || d.phone, { message: "email or phone required" });

export async function POST(req: NextRequest) {
  /*
    KOVA ANAHTARI IP BASINA (2026-08-31). Onceki hali sabit `register` idi:
    TEK bir kova tum dunyayi sayiyordu, yani saniyede bes istek atan biri
    GERCEK kayitlarin hepsini 429'a dusuruyordu. Kimlik dogrulama ucunda
    global kova bir hiz siniri degil, bedava hizmet disi birakma dugmesidir.
  */
  const ip = clientIp(req);
  if (!(await rateLimit(`register:ip:${ip}`, 10, 60_000))) {
    return NextResponse.json({ error: "too_many_attempts" }, { status: 429 });
  }

  const body = await req.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid_input" }, { status: 400 });
  }

  const { email, password, name } = parsed.data;
  const phone = parsed.data.phone ? normalizeTrGsm10(parsed.data.phone) ?? undefined : undefined;
  if (!phone && !email) {
    return NextResponse.json({ error: "invalid_input" }, { status: 400 });
  }

  const normalizedEmail = email ? email.toLowerCase().trim() : null;

  const existing = normalizedEmail
    ? await prisma.user.findUnique({ where: { email: normalizedEmail } })
    : phone
      ? await prisma.user.findFirst({
          where: {
            OR: [
              { phone },
              { phone: `+90${phone}` },
              { phone: `0${phone}` }
            ]
          }
        })
      : null;

  if (existing) {
    /*
      KIMLIK DOGRULAMA ATLAMASI (2026-08-31'de bulundu, en agir bulgu).

      Onceki hali soyleydi: hesap varsa, `passwordHash` DOLUYSA sifre
      dogrulanir; NULL ise hicbir sey dogrulanmaz ve alt satirda hesaba
      access + refresh token BASILIRDI.

      `passwordHash` null olan hesaplar: Google ile giren, Apple ile giren ve
      OTP ile acilan herkes. Yani bir e-posta adresini BILEN herhangi biri
      `POST /api/mobile/auth/register {email, password}` gonderip o hesabin
      mobil oturumunu aliyordu. Sifre gerekmiyordu; gonderilen sifre hicbir
      yere yazilmiyordu bile.

      Yikici hali: `auth.ts` icindeki `ADMIN_EMAILS` listesi Google ile ilk
      girişte hesabi ADMIN yapiyor -- ve o hesabin `passwordHash`'i null.
      Yonetici e-postasini bilen biri (depo ACIK KAYNAK, adres commit
      gecmisinde ve `docs/` icinde gecebilir) ADMIN rolunde mobil erisim
      token'i aliyordu: `/api/mobile/admin/*` ucunun tamami.

      Dogrusu: parolasiz hesapta bu uc hicbir token uretmez. Hesabin sahibi
      Google/Apple/OTP ile girer; sifre belirlemek isterse sifre sifirlama
      akisini kullanir (o akis e-posta sahipligini kanitlar).
    */
    if (!existing.passwordHash) {
      return NextResponse.json({ error: "account_exists_social" }, { status: 409 });
    }
    const { verifyPassword } = await import("@/lib/auth-password");
    const valid = await verifyPassword(password, existing.passwordHash);
    if (!valid) {
      return NextResponse.json({ error: "invalid_credentials" }, { status: 401 });
    }
    const access = await signAccessToken(existing.id, existing.role);
    const refresh = await signRefreshToken(existing.id, existing.role);
    return NextResponse.json({
      accessToken: access,
      refreshToken: refresh,
      user: toMobileUser(existing),
    });
  }

  const passwordHash = await hashPassword(password);
  const user = await prisma.user.create({
    data: {
      email: normalizedEmail,
      phone: phone || null,
      name: name || normalizedEmail?.split("@")[0] || `User${phone?.slice(-4)}`,
      passwordHash,
      role: "GUEST",
      emailVerified: normalizedEmail ? new Date() : null,
    },
  });

  void notificationService
    .notifyAdminsForNewUser({
      name: user.name,
      email: user.email,
      phone: user.phone,
      role: "GUEST",
      source: "mobile_register",
    })
    .catch((err) => logger.error({ err, userId: user.id }, "notify_admins_new_guest_failed"));

  analyticsService.track({
    name: "user_signed_up",
    sessionId: await resolveServerSessionId(user.id),
    userId: user.id,
    metadata: { source: "mobile_register", role: "GUEST" },
  });

  const access = await signAccessToken(user.id, user.role);
  const refresh = await signRefreshToken(user.id, user.role);

  return NextResponse.json({
    accessToken: access,
    refreshToken: refresh,
    user: toMobileUser(user),
  });
}
