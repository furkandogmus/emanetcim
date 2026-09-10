import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { requireMobileUser, requireRole } from "@/lib/mobile-auth";
import prisma from "@/lib/db";
import { CONTACT_MESSAGE_LIST_SELECT, CONTACT_MESSAGE_LIST_TAKE } from "@/lib/contact-message-list";

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const auth = await requireMobileUser(req);
  if ("error" in auth) return auth.error;
  const forbid = requireRole(auth.user, ["ADMIN"]);
  if (forbid) return forbid;

  const messages = await prisma.contactMessage.findMany({
    orderBy: { createdAt: "desc" },
    select: CONTACT_MESSAGE_LIST_SELECT,
    take: CONTACT_MESSAGE_LIST_TAKE,
  });

  return NextResponse.json(messages);
}
