import { NextResponse } from "next/server";
import { auth } from "@/auth";
import prisma from "@/lib/db";

function assertOrigin(req: Request): boolean {
  const origin = req.headers.get("origin") ?? req.headers.get("referer") ?? "";
  try {
    const host = new URL(origin).host;
    return host === req.headers.get("host");
  } catch {
    return false;
  }
}

/**
 * Admin mesajlar: okundu işaretle (PATCH) / sil (DELETE).
 * Server Action yerine route handler: tıklanınca RSC otomatik yeniden çekilmesini önler.
 */
export async function PATCH(
  req: Request,
  context: { params: Promise<{ id: string }> },
) {
  if (!assertOrigin(req)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const session = await auth();
  if (session?.user?.role !== "ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await context.params;

  // `update` olmayan kayitta P2025 firlatip 500 veriyordu; sayi kontrolu 404.
  const { count } = await prisma.contactMessage.updateMany({
    where: { id },
    data: { isRead: true },
  });
  if (count === 0) return NextResponse.json({ error: "not_found" }, { status: 404 });
  return NextResponse.json({ ok: true });
}

export async function DELETE(
  req: Request,
  context: { params: Promise<{ id: string }> },
) {
  if (!assertOrigin(req)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const session = await auth();
  if (session?.user?.role !== "ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await context.params;

  const { count } = await prisma.contactMessage.deleteMany({ where: { id } });
  if (count === 0) return NextResponse.json({ error: "not_found" }, { status: 404 });
  return NextResponse.json({ ok: true });
}
