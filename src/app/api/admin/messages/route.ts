import { NextResponse } from "next/server";
import { auth } from "@/auth";
import prisma from "@/lib/db";
import { getMobileSession } from "@/lib/mobile-auth";

export const dynamic = 'force-dynamic';

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
