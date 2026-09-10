import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { z } from "zod";
import prisma from "@/lib/db";
import { signAccessToken, signRefreshToken, verifyMobileToken } from "@/lib/mobile-auth";
import { rateLimit } from "@/lib/rate-limit";
import { clientIp } from "@/lib/internal-api-guard";
import { claimRefreshJti } from "@/lib/refresh-token-store";
import { revokeAllUserSessions } from "@/services/auth/mobile-session";
import logger from "@/lib/logger";

const schema = z.object({ refreshToken: z.string() });

export async function POST(req: NextRequest) {
  /*
    HIZ SINIRI (2026-08-31): bu uc hicbir sinir tasimiyordu ve her cagrida bir
    JWT dogrulamasi + bir `user` sorgusu yapiyor. Sinirsiz olmasi hem imza
    dogrulama denemelerini bedava kiliyor hem de tek bir istemcinin veritabani
    havuzunu doldurmasina izin veriyordu.
  */
  const ip = clientIp(req);
  if (!(await rateLimit(`mobile_refresh:ip:${ip}`, 60, 60_000))) {
    return NextResponse.json({ error: "too_many_attempts" }, { status: 429 });
  }

  const body = await req.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "invalid" }, { status: 400 });

  try {
    const claims = await verifyMobileToken(parsed.data.refreshToken);
    if (claims.type !== "refresh") throw new Error("bad type");
    const user = await prisma.user.findUnique({ where: { id: claims.sub } });
    if (!user) throw new Error("user gone");
    if (user.isBanned) throw new Error("user banned");
    if (user.tokenVersion !== (claims.tv ?? 0)) throw new Error("token version mismatch");

    /*
      TEKRAR KULLANIM (REPLAY) TESPITI (2026-09-10'da bulundu). `jti`
      YOKSA (bu degisiklikten ONCE basilmis eski bir refresh token) kontrol
      atlanir -- "aud tasimayan eski token hala gecer" ile ayni gecis donemi
      deseni (bkz. jwt-family-boundary.test.ts). `jti` VARSA: ayni jti ikinci
      kez sunulursa bu, token'in calinip HEM mesru cihaz HEM saldirgan
      tarafindan kullanildigi anlamina gelebilir -- TUM aile (`tokenVersion`
      artirilarak) iptal edilir, boylece calinmis token da mesru cihazin
      elindeki HENUZ KULLANILMAMIS diger token'lar da ayni anda dusurulur.
    */
    if (claims.jti) {
      const exp = typeof claims.exp === "number" ? claims.exp * 1000 : 0;
      const ttlMs = Math.max(0, exp - Date.now());
      const firstUse = await claimRefreshJti(claims.jti, ttlMs);
      if (!firstUse) {
        logger.warn({ userId: user.id }, "mobile_refresh_token_reuse_detected");
        await revokeAllUserSessions(user.id);
        return NextResponse.json({ error: "unauthorized" }, { status: 401 });
      }
    }

    const access = await signAccessToken(user.id, user.role, user.tokenVersion);
    const refresh = await signRefreshToken(user.id, user.role, user.tokenVersion);
    return NextResponse.json({ accessToken: access, refreshToken: refresh });
  } catch {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
}
