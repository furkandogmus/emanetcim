import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { z } from "zod";
import { requireMobileUser, signAccessToken, signRefreshToken } from "@/lib/mobile-auth";
import { rateLimit } from "@/lib/rate-limit";
import { setOwnPassword } from "@/services/auth/set-own-password";
import { sendPasswordSetNotice } from "@/lib/mail";
import { resolveRequestLocale } from "@/lib/request-locale";
import logger from "@/lib/logger";

const schema = z.object({
  currentPassword: z.string().max(128).optional(),
  newPassword: z.string().max(128),
});

/**
 * Sifre belirle / degistir. Sifresiz hesapta (kod ya da Google ile acilmis)
 * mevcut sifre istenmez; sifreliyse zorunlu. Degisimde oturumlar yenilenir:
 * yanitta yeni token cifti doner (`rotated: true`), istemci onu saklar.
 */
export async function POST(req: NextRequest) {
  const auth = await requireMobileUser(req);
  if ("error" in auth) return auth.error;

  if (!(await rateLimit(`mobile_pwd_change:${auth.user.id}`, 5, 15 * 60_000))) {
    return NextResponse.json({ error: "too_many_attempts" }, { status: 429 });
  }

  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid_input" }, { status: 400 });
  }

  const result = await setOwnPassword({
    userId: auth.user.id,
    currentPassword: parsed.data.currentPassword,
    newPassword: parsed.data.newPassword,
    impersonatedBy: auth.user.impersonatedBy,
  });
  if (!result.ok) {
    const status = result.reason === "invalid_current_password" ? 403 : result.reason === "not_found" ? 404 : 400;
    return NextResponse.json({ error: result.reason }, { status });
  }
  if (!result.rotated) {
    /*
      Sifresiz hesapta ilk sifre: calinmis bir token ile sahibin haberi olmadan
      kalici kimlik bilgisi koyulmasin diye hesap sahibine e-posta gider.
      Goruntuleme oturumunda (destek) gitmez. Ateşle-unut: hata isteği dusurmez.
    */
    if (auth.user.impersonatedBy === undefined && auth.user.email) {
      void sendPasswordSetNotice(auth.user.email, resolveRequestLocale(req.headers.get("accept-language"))).catch(
        (err) => logger.error({ err, userId: auth.user.id }, "password_set_notice_failed"),
      );
    }
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({
    ok: true,
    accessToken: await signAccessToken(auth.user.id, auth.user.role, result.tokenVersion),
    refreshToken: await signRefreshToken(auth.user.id, auth.user.role, result.tokenVersion),
  });
}
