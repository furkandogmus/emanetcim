import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { requireMobileUser } from "@/lib/mobile-auth";
import { revokeAllUserSessions } from "@/services/auth/mobile-session";
import logger from "@/lib/logger";

/**
 * Mobil cikis.
 *
 * NEDEN DEGISTI (2026-08-31): onceki hali yalnizca `prisma.session.deleteMany`
 * cagiriyordu. `Session` tablosu **web** Auth.js adapter'ina ait; mobil kimlik
 * tamamen durumsuz JWT. Yani "cikis yap" dugmesi mobilde HICBIR SEY yapmiyordu:
 * access token 15 dakika, **refresh token 30 GUN** daha gecerli kaliyordu.
 * Odunc verilen ya da calinan bir telefonda cikis yapmak hesabi korumuyordu ve
 * kullanici korundugunu saniyordu.
 *
 * BILINCLI TAVIZ: cihaz kaydi olmadigi icin bu "tum cihazlardan cikis"tir. Tek
 * cihazi dusurmek refresh token'lara `jti` verip iptal listesi tutmayi
 * gerektirir; o gelene kadar dogru varsayilan, cikisin GERCEKTEN cikis olmasi.
 */
export async function POST(req: NextRequest) {
  const auth = await requireMobileUser(req);
  if ("error" in auth) return auth.error;

  try {
    await revokeAllUserSessions(auth.user.id);
    return NextResponse.json({ success: true });
  } catch (err) {
    logger.error({ err, userId: auth.user.id }, "mobile_logout_failed");
    return NextResponse.json({ error: "server_error" }, { status: 500 });
  }
}
