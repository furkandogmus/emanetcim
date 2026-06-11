import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import prisma from "@/lib/db";
import { requireMobileUser } from "@/lib/mobile-auth";

export async function GET(req: NextRequest) {
  const auth = await requireMobileUser(req);
  if ("error" in auth) return auth.error;

  const user = await prisma.user.findUnique({
    where: { id: auth.user.id },
    select: { referralCode: true },
  });

  if (!user?.referralCode) {
    return NextResponse.json({ error: "no_referral_code" }, { status: 404 });
  }

  return NextResponse.json({ code: user.referralCode });
}
