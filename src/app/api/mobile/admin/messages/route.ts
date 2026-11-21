import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { requireMobileUser, requireRole } from "@/lib/mobile-auth";
import prisma from "@/lib/db";
import { toMobileAdminMessage } from "@/lib/mobile-dto";
import { cursorArgs, parseCursor, toPage } from "@/lib/cursor-page";

/** Mobil liste web'den kucuk: telefonda 200 mesajin govdesi okunmaz. */
const MOBILE_MESSAGE_TAKE = 100;
/** Sayfali istemcide sayfa boyu. */
const MOBILE_MESSAGE_PAGE = 30;

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const auth = await requireMobileUser(req);
  if ("error" in auth) return auth.error;
  const forbid = requireRole(auth.user, ["ADMIN"]);
  if (forbid) return forbid;

  /*
    `?paged=1[&cursor=]` -> `{ messages, nextCursor }`. Parametresiz istek eski
    uygulama surumleri (0.3.0-0.3.3) icin eskisi gibi dizi: en yeni 100, devami yok.
  */
  const sp = req.nextUrl.searchParams;
  const paged = sp.get("paged") === "1";
  const take = paged ? MOBILE_MESSAGE_PAGE : MOBILE_MESSAGE_TAKE;
  const rows = await prisma.contactMessage.findMany({
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
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
    ...(paged ? cursorArgs(parseCursor(sp.get("cursor")), take) : { take }),
  });

  if (!paged) return NextResponse.json(rows.map(toMobileAdminMessage));
  const page = toPage(rows, take);
  return NextResponse.json({ messages: page.items.map(toMobileAdminMessage), nextCursor: page.nextCursor });
}
