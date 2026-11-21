import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { z } from "zod";
import type { Role } from "@prisma/client";
import prisma from "@/lib/db";
import {
  serviceUnavailable,
  signAccessToken,
  signRefreshToken,
  unauthorized,
  verifyMobileToken,
} from "@/lib/mobile-auth";
import { rateLimit } from "@/lib/rate-limit";
import { clientIp } from "@/lib/internal-api-guard";
import { claimRefreshJti, rememberIssuedPair, type RefreshClaim } from "@/lib/refresh-token-store";
import { revokeAllUserSessions } from "@/services/auth/mobile-session";
import logger from "@/lib/logger";

const schema = z.object({ refreshToken: z.string() });

/*
  401 YALNIZCA token sorununda (2026-11-21). Eskiden Prisma/Redis hatasi da ayni
  `catch`e dusup 401 donuyordu; istemci 401'de token'lari silip kullaniciyi
  cikisa atiyordu. Altyapi hatasi 503: istemci onu "network" sayar, oturum kalir.
*/
export async function POST(req: NextRequest) {
  const ip = clientIp(req);
  let allowed: boolean;
  try {
    allowed = await rateLimit(`mobile_refresh:ip:${ip}`, 60, 60_000);
  } catch (err) {
    logger.warn({ err }, "mobile_refresh_rate_limit_unavailable");
    return serviceUnavailable();
  }
  if (!allowed) return NextResponse.json({ error: "too_many_attempts" }, { status: 429 });

  const body = await req.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "invalid" }, { status: 400 });

  let claims: Awaited<ReturnType<typeof verifyMobileToken>>;
  try {
    claims = await verifyMobileToken(parsed.data.refreshToken);
  } catch {
    return unauthorized();
  }
  if (claims.type !== "refresh") return unauthorized();
  // Yonetici goruntuleme oturumu asla yenilenmez (imp tasiyan refresh hic basilmaz).
  if (claims.imp !== undefined) return unauthorized();

  let user: { id: string; role: Role; isBanned: boolean; tokenVersion: number } | null;
  try {
    user = await prisma.user.findUnique({
      where: { id: claims.sub },
      select: { id: true, role: true, isBanned: true, tokenVersion: true },
    });
  } catch (err) {
    logger.warn({ err }, "mobile_refresh_db_unavailable");
    return serviceUnavailable();
  }
  if (!user || user.isBanned || user.tokenVersion !== (claims.tv ?? 0)) return unauthorized();

  /*
    TEKRAR KULLANIM: `jti` YOKSA (eski token) kontrol atlanir. Pencere icindeki
    tekrar ayni cifti alir; pencere disindaki tekrar tum aileyi iptal eder
    (bkz. refresh-token-store.ts).
  */
  let claim: RefreshClaim = { kind: "first" };
  if (claims.jti) {
    const exp = typeof claims.exp === "number" ? claims.exp * 1000 : 0;
    try {
      claim = await claimRefreshJti(claims.jti, Math.max(0, exp - Date.now()));
    } catch (err) {
      logger.warn({ err }, "mobile_refresh_store_unavailable");
      return serviceUnavailable();
    }
  }

  if (claim.kind === "repeat") return NextResponse.json(claim.pair);
  // Ilk istegin cifti henuz yazilmadi: istemci "network" sayar, birazdan tekrar dener.
  if (claim.kind === "pending") return serviceUnavailable();
  if (claim.kind === "reused") {
    logger.warn({ userId: user.id }, "mobile_refresh_token_reuse_detected");
    try {
      await revokeAllUserSessions(user.id);
    } catch (err) {
      logger.warn({ err }, "mobile_refresh_revoke_failed");
      return serviceUnavailable();
    }
    return unauthorized();
  }

  const pair = {
    accessToken: await signAccessToken(user.id, user.role, user.tokenVersion),
    refreshToken: await signRefreshToken(user.id, user.role, user.tokenVersion),
  };
  if (claims.jti) {
    // Yazilamazsa eski davranis: tekrar gelirse replay sayilir. Yanit yine doner.
    await rememberIssuedPair(claims.jti, pair).catch((err: unknown) => {
      logger.warn({ err }, "mobile_refresh_pair_store_failed");
    });
  }
  return NextResponse.json(pair);
}
