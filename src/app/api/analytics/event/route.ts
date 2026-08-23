import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { z } from "zod";
import { auth } from "@/auth";
import { analyticsService } from "@/services/AnalyticsService";
import { CLIENT_ANALYTICS_EVENTS } from "@/lib/analytics-events";
import { rateLimit } from "@/lib/rate-limit";
import { getClientIp } from "@/lib/get-ip";

/**
 * Birinci taraf analitik olay girişi — yalnızca istemcinin gönderebileceği
 * (kimliksiz, `navigator.sendBeacon`/fetch ile) olaylar için. Booking/kayıt gibi
 * iş-kritik olaylar buradan GEÇMİYOR — onlar zaten sunucu tarafında ilgili
 * action/route içinde `analyticsService.track()` ile doğrudan yazılıyor (bkz.
 * `src/lib/analytics-events.ts` — CLIENT_ANALYTICS_EVENTS vs SERVER_ANALYTICS_EVENTS).
 *
 * Rıza kontrolü istemci tarafında yapılıyor (`hasAnalyticsConsent`) — bu uç
 * kendi başına açık, ama rızasız istemci zaten hiç çağırmıyor.
 */
const schema = z.object({
  name: z.enum(CLIENT_ANALYTICS_EVENTS),
  sessionId: z.string().min(8).max(64),
  path: z.string().max(256).optional(),
  referrer: z.string().max(256).optional(),
  locale: z.string().max(16).optional(),
});

export async function POST(req: NextRequest) {
  const ip = await getClientIp(req);
  if (!(await rateLimit(`analytics_event:${ip}`, 60, 60_000))) {
    return NextResponse.json({ ok: false }, { status: 429 });
  }

  // `sendBeacon` metni "text/plain" olarak gönderir; ikisini de JSON kabul et.
  const raw = await req.text();
  const body = (() => {
    try {
      return JSON.parse(raw);
    } catch {
      return null;
    }
  })();

  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ ok: false }, { status: 400 });
  }

  const session = await auth();

  analyticsService.track({
    name: parsed.data.name,
    sessionId: parsed.data.sessionId,
    userId: session?.user?.id ?? null,
    path: parsed.data.path ?? null,
    referrer: parsed.data.referrer ?? null,
    locale: parsed.data.locale ?? null,
  });

  return NextResponse.json({ ok: true });
}
