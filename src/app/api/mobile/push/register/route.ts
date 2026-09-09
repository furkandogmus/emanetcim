import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { z } from "zod";
import prisma from "@/lib/db";
import { requireMobileUser } from "@/lib/mobile-auth";
import { toMobileDevice } from "@/lib/mobile-dto";

const schema = z.object({
  token: z.string().min(10),
  platform: z.enum(["ios", "android"]),
  appVersion: z.string().optional(),
  locale: z.string().optional(),
});

/** "Bildirim alan cihazlar" ekranı — kullanıcının kendi push token'ları. */
export async function GET(req: NextRequest) {
  const auth = await requireMobileUser(req);
  if ("error" in auth) return auth.error;
  const rows = await prisma.mobilePushToken.findMany({
    where: { userId: auth.user.id },
    orderBy: { lastSeenAt: "desc" },
  });
  return NextResponse.json({ items: rows.map(toMobileDevice) });
}

export async function POST(req: NextRequest) {
  const auth = await requireMobileUser(req);
  if ("error" in auth) return auth.error;
  const body = await req.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "invalid" }, { status: 400 });

  const { token, platform, appVersion, locale } = parsed.data;

  await prisma.mobilePushToken.upsert({
    where: { token },
    update: {
      userId: auth.user.id,
      platform,
      appVersion,
      locale,
      lastSeenAt: new Date(),
    },
    create: {
      userId: auth.user.id,
      token,
      platform,
      appVersion,
      locale,
    },
  });

  return NextResponse.json({ ok: true });
}

export async function DELETE(req: NextRequest) {
  const auth = await requireMobileUser(req);
  if ("error" in auth) return auth.error;
  const body = await req.json().catch(() => null);
  const parsed = schema.pick({ token: true }).safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "invalid" }, { status: 400 });
  await prisma.mobilePushToken.deleteMany({
    where: { token: parsed.data.token, userId: auth.user.id },
  });
  return NextResponse.json({ ok: true });
}
