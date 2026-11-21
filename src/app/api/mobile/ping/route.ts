import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { z } from "zod";

import { clientIpFromHeaders } from "@/lib/client-ip";
import { requireMobileUser } from "@/lib/mobile-auth";
import { rateLimit } from "@/lib/rate-limit";
import { mobileInstallService } from "@/services/MobileInstallService";

const Body = z.object({
  installId: z.string().uuid(),
  platform: z.enum(["ios", "android"]),
  appVersion: z.string().max(32).optional(),
});

/**
 * Uygulama acilisi: tekil kullanici sayaci (`MobileInstall`). Girissiz de cagrilir.
 *
 * Oturum basligi varsa ve gecerliyse kullanici yazilir; gecersizse istek yine
 * sayilir ve 401 DONMEZ: istemcinin `api()`si 401'de oturumu kapatir, sayac
 * istegi kimseyi cikisa dusurmemeli.
 */
export async function POST(req: NextRequest) {
  const ip = clientIpFromHeaders(req.headers);
  if (!(await rateLimit(`mobile_ping:${ip}`, 30, 60_000))) {
    return NextResponse.json({ error: "rate_limited" }, { status: 429 });
  }

  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "invalid" }, { status: 400 });
  const { installId, platform, appVersion } = parsed.data;

  let userId: string | undefined;
  if (req.headers.get("authorization")) {
    const auth = await requireMobileUser(req);
    // Goruntuleme oturumu yoneticinin cihazini hedef kullaniciya baglamaz.
    if (!("error" in auth) && !auth.user.impersonatedBy) userId = auth.user.id;
  }

  await mobileInstallService.recordOpen({ installId, platform, appVersion, userId });

  // `linked`: istemci suresi dolmus token'la geldiyse yenileyip tekrar dener (app-ping.ts).
  return NextResponse.json({ ok: true, linked: userId !== undefined });
}
