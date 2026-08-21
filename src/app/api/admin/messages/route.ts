import { NextResponse } from "next/server";
import { auth } from "@/auth";
import prisma from "@/lib/db";
import { getMobileSession } from "@/lib/mobile-auth";

export const dynamic = 'force-dynamic';

function assertOrigin(req: Request): boolean {
  const origin = req.headers.get("origin") ?? req.headers.get("referer") ?? "";
  try {
    const host = new URL(origin).host;
    return host === req.headers.get("host");
  } catch {
    return false;
  }
}

export async function GET() {
  // Check mobile session first
  const mobileSession = await getMobileSession();
  let isAdmin = mobileSession?.role === "ADMIN";

  // If not mobile, check web session
  if (!isAdmin) {
    const webSession = await auth();
    isAdmin = webSession?.user?.role === "ADMIN";
  }

  if (!isAdmin) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const messages = await prisma.contactMessage.findMany({
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json(messages);
}

export async function DELETE(req: Request) {
  if (!assertOrigin(req)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const session = await auth();
  if (session?.user?.role !== "ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = (await req.json().catch(() => null)) as { ids?: unknown } | null;
  const ids = Array.isArray(body?.ids)
    ? body.ids.filter((id): id is string => typeof id === "string").slice(0, 100)
    : [];

  if (ids.length === 0) {
    return NextResponse.json({ error: "No messages selected" }, { status: 400 });
  }

  const result = await prisma.contactMessage.deleteMany({ where: { id: { in: ids } } });
  return NextResponse.json({ ok: true, deleted: result.count });
}
