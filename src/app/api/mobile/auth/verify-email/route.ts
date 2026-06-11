import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import prisma from "@/lib/db";

export async function POST(req: NextRequest) {
  try {
    const { token } = await req.json();

    if (!token) {
      return NextResponse.json({ error: "invalid_data" }, { status: 400 });
    }

    // Token'ı bul
    const existingToken = await prisma.verificationToken.findUnique({
      where: { token },
    });

    if (!existingToken) {
      return NextResponse.json({ error: "token_not_found" }, { status: 400 });
    }

    const hasExpired = new Date(existingToken.expires) < new Date();
    if (hasExpired) {
      return NextResponse.json({ error: "token_expired" }, { status: 400 });
    }

    // Kullanıcıyı bul ve doğrula
    const existingUser = await prisma.user.findUnique({
      where: { email: existingToken.identifier },
    });

    if (!existingUser) {
      return NextResponse.json({ error: "user_not_found" }, { status: 404 });
    }

    await prisma.$transaction([
      prisma.user.update({
        where: { id: existingUser.id },
        data: { emailVerified: new Date(), email: existingToken.identifier },
      }),
      prisma.verificationToken.delete({
        where: { token },
      }),
    ]);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("verify-email API error:", error);
    return NextResponse.json({ error: "server_error" }, { status: 500 });
  }
}
