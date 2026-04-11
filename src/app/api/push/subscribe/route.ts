import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import prisma from "@/lib/db";
import logger from "@/lib/logger";

export const runtime = "nodejs";

type Body = {
  endpoint?: string;
  keys?: { p256dh?: string; auth?: string };
};

/**
 * Web Push aboneliği (VAPID). İstemci: `NEXT_PUBLIC_VAPID_PUBLIC_KEY` ile subscribe sonrası POST.
 */
export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = (await req.json()) as Body;
    const endpoint = body.endpoint?.trim();
    const p256dh = body.keys?.p256dh?.trim();
    const subAuth = body.keys?.auth?.trim();
    if (!endpoint || !p256dh || !subAuth) {
      return NextResponse.json({ error: "Invalid subscription" }, { status: 400 });
    }

    await prisma.pushSubscription.upsert({
      where: { endpoint },
      create: {
        userId: session.user.id,
        endpoint,
        p256dh,
        auth: subAuth,
      },
      update: { userId: session.user.id, p256dh, auth: subAuth },
    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    logger.error({ err }, "push_subscribe_failed");
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const body = (await req.json()) as Body;
    const endpoint = body.endpoint?.trim();
    if (!endpoint) {
      return NextResponse.json({ error: "Missing endpoint" }, { status: 400 });
    }
    await prisma.pushSubscription.deleteMany({
      where: { userId: session.user.id, endpoint },
    });
    return NextResponse.json({ ok: true });
  } catch (err) {
    logger.error({ err }, "push_unsubscribe_failed");
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
