import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { requireMobileUser, requireRole } from "@/lib/mobile-auth";
import prisma from "@/lib/db";
import { toMobileAdminMessage } from "@/lib/mobile-dto";

/** Mobil liste web'den kucuk: telefonda 200 mesajin govdesi okunmaz. */
const MOBILE_MESSAGE_TAKE = 100;

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const auth = await requireMobileUser(req);
  if ("error" in auth) return auth.error;
  const forbid = requireRole(auth.user, ["ADMIN"]);
  if (forbid) return forbid;

  const messages = await prisma.contactMessage.findMany({
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      from: true,
      subject: true,
      text: true,
      html: true,
      isRead: true,
      category: true,
      createdAt: true,
      replies: { select: { createdAt: true }, orderBy: { createdAt: "desc" }, take: 1 },
    },
    take: MOBILE_MESSAGE_TAKE,
  });

  return NextResponse.json(messages.map(toMobileAdminMessage));
}
