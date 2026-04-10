import { NextResponse } from "next/server";
import { auth } from "@/auth";
import prisma from "@/lib/db";

/**
 * Admin mesajlar: okundu işaretle (PATCH) / sil (DELETE).
 * Server Action yerine route handler: tıklanınca RSC otomatik yeniden çekilmesini önler.
 */
export async function PATCH(
  _req: Request,
  context: { params: Promise<{ id: string }> },
) {
  const session = await auth();
  if (session?.user?.role !== "ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await context.params;

  await prisma.contactMessage.update({
    where: { id },
    data: { isRead: true },
  });

  return NextResponse.json({ ok: true });
}

export async function DELETE(
  _req: Request,
  context: { params: Promise<{ id: string }> },
) {
  const session = await auth();
  if (session?.user?.role !== "ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await context.params;

  await prisma.contactMessage.delete({
    where: { id },
  });

  return NextResponse.json({ ok: true });
}
