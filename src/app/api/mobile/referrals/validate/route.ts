import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import prisma from "@/lib/db";

export async function POST(req: NextRequest) {
  const { code } = await req.json();
  if (!code) return NextResponse.json({ error: "invalid_data" }, { status: 400 });

  const referrer = await prisma.user.findFirst({
    where: { referralCode: code.toUpperCase().trim() },
    select: { id: true, name: true },
  });

  if (!referrer) {
    return NextResponse.json({ valid: false, error: "invalid_code" }, { status: 200 });
  }

  return NextResponse.json({ valid: true, referrerName: referrer.name });
}
