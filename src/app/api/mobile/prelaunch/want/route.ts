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
 * web'de `bp_anon` cerezi, burada HER ZAMAN uygulamanin cihazda tuttugu kimlik
 * (`device:<uuid>`): once girissiz tiklayip sonra giris yapan kisi ikinci kez
 * sayilmaz. Hesap yalniz "acilinca haber ver" kaydinin e-postasi icin okunur; ayni
 * istek tekrar gelirse sayac artmaz, yalniz haber verme kaydi yazilir.
 *
 * Cihaz kimligi istemcide uretilir, yani tek basina sisirmeye karsi koruma degil:
 * yonetici raporu `device:` isteklerini ayri sayar (`summary`). Hiz siniri IP + nokta
 * basina; otel NAT'indaki farkli noktalara bakan misafirler birbirini kilitlemez.
 */
const schema = z.object({
  shopId: z.string().uuid(),
  deviceId: z.string().uuid(),
  /** Girisli kullanicinin hesap e-postasina "acilinca haber ver" kaydi da yazilir. */
  notify: z.boolean().optional(),
  locale: z.string().min(2).max(10).optional(),
});

export async function POST(req: NextRequest) {
  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "invalid" }, { status: 400 });
  const { shopId, deviceId, notify, locale } = parsed.data;

  const ip = await getClientIp(req);
  if (!(await rateLimit(`mobile_prelaunch_want:${ip}:${shopId}`, 10, 10 * 60_000))) {
    return NextResponse.json({ error: "too_many_requests" }, { status: 429 });
  }

  // Bearer geldiyse dogrulanir; reddedilirse 401 (istemci yeniler), anonime dusulmez.
  let user: { id: string; email: string | null } | null = null;
  if (req.headers.get("authorization")?.startsWith("Bearer ")) {
    const auth = await requireMobileUser(req);
    if ("error" in auth) return auth.error;
    const blocked = forbidWhileImpersonating(auth.user);
    if (blocked) return blocked;
    user = { id: auth.user.id, email: auth.user.email };
  }
  const anonId = `device:${deviceId}`;
  /*
    Sayim web ile AYNI kovada: IP + nokta basina gunde bir. Cihaz kimligi istemcide
    uretildigi icin yenisiyle sayac sisirilebiliyordu. Asan istek "zaten sayildi" alir.
  */
  const countable = await rateLimit(`prelaunch_want_ip:${ip}:${shopId}`, 1, 24 * 60 * 60_000);
  const want = countable
    ? await prelaunchInterestService.registerWant({ shopId, anonId, locale, source: "mobile" })
    : {
        ok: true as const,
        alreadyCounted: true,
        count: await prelaunchInterestService.wantCount(shopId).catch(() => 0),
      };
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
