import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { z } from "zod";
import prisma from "@/lib/db";
import { rateLimit } from "@/lib/rate-limit";
import { clientIp } from "@/lib/internal-api-guard";

/**
 * Referans kodu dogrulama — KIMLIKSIZ cagrilabilir.
 *
 * NEDEN SERTLESTIRILDI (2026-08-31):
 *
 * 1. **Hicbir hiz siniri yoktu.** Uc kimlik dogrulamasiz ve her cagrida bir
 *    veritabani sorgusu yapiyor. Kod uzayi kaba kuvvete kapali (sekiz karakter,
 *    32 harfli alfabe = ~1,1 x 10^12), yani kod TAHMIN edilemez -- ama sinirsiz
 *    bir uc yine de bedava sorgu ureteci. Projedeki diger kimliksiz uclarin
 *    hepsinde sinir var; bu atlanmis.
 * 2. **Govde dogrulanmiyordu.** `code.toUpperCase()` dogrudan cagriliyordu:
 *    `{"code": 123}` gondermek `TypeError` firlatip 500 uretiyordu. Gecersiz
 *    girdi 400 olmali, sunucu hatasi degil.
 *
 * Yanittaki `referrerName` BILINCLI: davet ekrani "X sizi davet etti" yaziyor.
 * Kodu bilen zaten daveti alan kisidir.
 */
const schema = z.object({ code: z.string().trim().min(1).max(32) });

export async function POST(req: NextRequest) {
  const ip = clientIp(req);
  if (!(await rateLimit(`referral_validate:ip:${ip}`, 30, 10 * 60_000))) {
    return NextResponse.json({ error: "too_many_requests" }, { status: 429 });
  }

  const body = await req.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid_data" }, { status: 400 });
  }

  const referrer = await prisma.user.findFirst({
    where: { referralCode: parsed.data.code.toUpperCase() },
    select: { id: true, name: true },
  });

  if (!referrer) {
    return NextResponse.json({ valid: false, error: "invalid_code" }, { status: 200 });
  }

  return NextResponse.json({ valid: true, referrerName: referrer.name });
}
