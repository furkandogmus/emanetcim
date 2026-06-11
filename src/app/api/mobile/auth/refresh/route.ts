import { NextResponse } from "next/server";
import { z } from "zod";
import prisma from "@/lib/db";
import { signAccessToken, signRefreshToken, verifyMobileToken } from "@/lib/mobile-auth";

const schema = z.object({ refreshToken: z.string() });

export async function POST(req: Request) {
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

    const access = await signAccessToken(user.id, user.role);
    const refresh = await signRefreshToken(user.id, user.role);
    return NextResponse.json({ accessToken: access, refreshToken: refresh });
  } catch {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
}
