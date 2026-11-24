import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { z } from "zod";
import { clientIpFromRequest } from "@/lib/client-ip";
import { forbidWhileImpersonating, requireMobileUser, requireRole } from "@/lib/mobile-auth";
import { toMobileAdminMessage } from "@/lib/mobile-dto";
import { parseCursor } from "@/lib/cursor-page";
import {
  adminInboxService,
  INBOX_BULK_MAX,
  INBOX_CATEGORIES,
  type InboxCategory,
} from "@/services/AdminInboxService";

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
    Suzgecler (web kutusuyla ayni): `unread=1`, `category=SUPPORT|BULK|AUTOMATED`, `q=`.
    Ilk sayfa kategori sayilarini da tasir.
  */
  const sp = req.nextUrl.searchParams;
  if (sp.get("paged") !== "1") {
    const rows = await adminInboxService.listRecent(MOBILE_MESSAGE_TAKE);
    return NextResponse.json(rows.map(toMobileAdminMessage));
  }

  const rawCategory = sp.get("category");
  const category = (INBOX_CATEGORIES as readonly string[]).includes(rawCategory ?? "")
    ? (rawCategory as InboxCategory)
    : null;
  const cursor = parseCursor(sp.get("cursor"));
  const [page, counts] = await Promise.all([
    adminInboxService.listPage(
      { unreadOnly: sp.get("unread") === "1", category, q: sp.get("q") ?? "" },
      { cursor, take: MOBILE_MESSAGE_PAGE },
    ),
    cursor ? Promise.resolve(null) : adminInboxService.counts(),
  ]);
  return NextResponse.json({
    messages: page.items.map(toMobileAdminMessage),
    nextCursor: page.nextCursor,
    ...(counts ? { counts } : {}),
  });
}

const BulkDeleteSchema = z.object({ ids: z.array(z.string().min(1).max(64)).min(1).max(INBOX_BULK_MAX) }).strict();

/** Toplu sil (web kutusundaki "secilenleri sil" ile ayni govde). */
export async function DELETE(req: NextRequest) {
  const auth = await requireMobileUser(req);
  if ("error" in auth) return auth.error;
  const blocked = forbidWhileImpersonating(auth.user);
  if (blocked) return blocked;
  const forbid = requireRole(auth.user, ["ADMIN"]);
  if (forbid) return forbid;

  const parsed = BulkDeleteSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "invalid_data" }, { status: 400 });

  const deleted = await adminInboxService.removeMany(parsed.data.ids, {
    userId: auth.user.id,
    ip: clientIpFromRequest(req),
  });
  return NextResponse.json({ ok: true, deleted });
}
