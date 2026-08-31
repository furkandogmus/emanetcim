import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { z } from "zod";
import prisma from "@/lib/db";
import { signAccessToken, signRefreshToken, verifyMobileToken } from "@/lib/mobile-auth";
import { rateLimit } from "@/lib/rate-limit";
import { clientIp } from "@/lib/internal-api-guard";

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

    const access = await signAccessToken(user.id, user.role, user.tokenVersion);
    const refresh = await signRefreshToken(user.id, user.role, user.tokenVersion);
    return NextResponse.json({ accessToken: access, refreshToken: refresh });
  } catch {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
}
