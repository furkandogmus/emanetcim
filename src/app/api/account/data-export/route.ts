import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/auth";
import { rejectIfImpersonating } from "@/lib/impersonation-guard";
import { rateLimit } from "@/lib/rate-limit";
import { getClientIp } from "@/lib/get-ip";
import { accountDataExportService } from "@/services/AccountDataExportService";
import { dataExportEmailResponse } from "@/lib/data-export-response";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * KVKK veri dışa aktarma (oturum açık kullanıcı, her rol). GET dosyayı indirir,
 * POST aynı içeriği doğrulanmış adrese e-postalar (mobil de POST'un servisini kullanır).
 */
export async function GET() {
  const session = await auth();
  const blocked = rejectIfImpersonating(session);
  if (blocked) return blocked;
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const userId = session.user.id;

  // Tek istekte kullanicinin butun gecmisi okunuyor: sinir maliyet icin (2026-09-02).
  const ip = await getClientIp();
  if (!(await rateLimit(`data-export:${userId}`, 5, 60 * 60 * 1000))) {
    return NextResponse.json({ error: "Too many requests" }, { status: 429 });
  }
  if (!(await rateLimit(`data-export:ip:${ip}`, 20, 60 * 60 * 1000))) {
    return NextResponse.json({ error: "Too many requests" }, { status: 429 });
  }

  const payload = await accountDataExportService.buildExport(userId);
  if (!payload) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  return new NextResponse(JSON.stringify(payload, null, 2), {
    status: 200,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": `attachment; filename="bagajpark-data-${userId.slice(0, 8)}.json"`,
    },
  });
}

const EmailBody = z.object({ locale: z.string().max(8).optional() });

export async function POST(req: Request) {
  const session = await auth();
  // Goruntulemede hedefin verisi yoneticinin istegiyle hedefe e-postalanmaz (proxy de keser).
  const blocked = rejectIfImpersonating(session);
  if (blocked) return blocked;
  if (!session?.user?.id) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const parsed = EmailBody.safeParse((await req.json().catch(() => ({}))) ?? {});
  if (!parsed.success) return NextResponse.json({ error: "invalid_data" }, { status: 400 });

  const result = await accountDataExportService.emailExport({
    userId: session.user.id,
    role: session.user.role,
    locale: parsed.data.locale,
    ip: await getClientIp(),
    channel: "web",
  });
  return dataExportEmailResponse(result);
}
