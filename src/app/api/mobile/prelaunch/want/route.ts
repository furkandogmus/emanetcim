import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { z } from "zod";
import { forbidWhileImpersonating, requireMobileUser } from "@/lib/mobile-auth";
import { prelaunchInterestService } from "@/services/PrelaunchInterestService";
import { rateLimit } from "@/lib/rate-limit";
import { getClientIp } from "@/lib/get-ip";
import logger from "@/lib/logger";

/**
 * Talep testi noktasi: "burada olsun" tek tik + (girisliyse) "acilinca haber ver".
 *
 * Web `registerPrelaunchWantAction` ile ayni govde (`registerWant`). Dedupe anahtari
 * web'de `bp_anon` cerezi; burada girisli kullanicida hesap, girissizde uygulamanin
 * cihazda tuttugu rastgele kimlik. Cihaz kimligi istemcide uretildigi icin IP basina
 * hiz siniri sayacin sisirilmesini sinirlar.
 */
const schema = z.object({
  shopId: z.string().uuid(),
  deviceId: z.string().uuid().optional(),
  /** Girisli kullanicinin hesap e-postasina "acilinca haber ver" kaydi da yazilir. */
  notify: z.boolean().optional(),
  locale: z.string().min(2).max(10).optional(),
});

export async function POST(req: NextRequest) {
  const ip = await getClientIp(req);
  if (!(await rateLimit(`mobile_prelaunch_want:${ip}`, 10, 10 * 60_000))) {
    return NextResponse.json({ error: "too_many_requests" }, { status: 429 });
  }

  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "invalid" }, { status: 400 });
  const { shopId, deviceId, notify, locale } = parsed.data;

  // Bearer geldiyse dogrulanir; reddedilirse 401 (istemci yeniler), anonime dusulmez.
  let user: { id: string; email: string | null } | null = null;
  if (req.headers.get("authorization")?.startsWith("Bearer ")) {
    const auth = await requireMobileUser(req);
    if ("error" in auth) return auth.error;
    const blocked = forbidWhileImpersonating(auth.user);
    if (blocked) return blocked;
    user = { id: auth.user.id, email: auth.user.email };
  }
  const anonId = user ? `user:${user.id}` : deviceId ? `device:${deviceId}` : null;
  if (!anonId) return NextResponse.json({ error: "invalid" }, { status: 400 });

  const want = await prelaunchInterestService.registerWant({ shopId, anonId, locale, source: "mobile" });
  if (!want.ok) {
    return want.code === "shop_not_prelaunch"
      ? NextResponse.json({ error: "shop_now_open" }, { status: 409 })
      : NextResponse.json({ error: "server_error" }, { status: 500 });
  }

  let subscribed: "new" | "already" | null = null;
  if (notify && user?.email) {
    try {
      const r = await prelaunchInterestService.record({ shopId, email: user.email, locale, source: "mobile" });
      if (r.ok) subscribed = r.alreadyRegistered ? "already" : "new";
    } catch (err) {
      // Sayac yazildi; haber verme kaydi dusse de istek basarili sayilir.
      logger.warn({ err, shopId }, "mobile_prelaunch_notify_failed");
    }
  }

  return NextResponse.json({ count: want.count, alreadyCounted: want.alreadyCounted, subscribed });
}
