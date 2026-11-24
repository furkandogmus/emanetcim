import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { parseCursor } from "@/lib/cursor-page";
import { requireMobileUser, requireRole } from "@/lib/mobile-auth";
import { toMobileAdminNotificationLog } from "@/lib/mobile-dto";
import { notificationLogService } from "@/services/NotificationLogService";

/** Tur ve durum degerleri (`EMAIL_CONFIRMATION`, `SENT`...); baska karakter suzgece girmez. */
const CODE_RE = /^[A-Za-z_]{1,60}$/;
const code = (raw: string | null) => {
  const v = (raw ?? "").trim();
  return CODE_RE.test(v) && v !== "ALL" ? v : null;
};

/**
 * Bildirim defteri (salt okuma). `?status=` `?type=` `?q=` (alici) `?cursor=`.
 * Suzgec web `/admin/notifications` ile ortak (`NotificationLogService`); suzulmemis
 * ilk sayfa secenekleri ve basarisiz sayisini da tasir.
 */
export async function GET(req: NextRequest) {
  const auth = await requireMobileUser(req);
  if ("error" in auth) return auth.error;
  const forbid = requireRole(auth.user, ["ADMIN"]);
  if (forbid) return forbid;

  const sp = req.nextUrl.searchParams;
  const filter = { status: code(sp.get("status")), type: code(sp.get("type")), q: (sp.get("q") ?? "").slice(0, 100) };
  const cursor = parseCursor(sp.get("cursor"));
  const [page, facets] = await Promise.all([
    notificationLogService.listPage(filter, { cursor, take: 30 }),
    cursor ? null : notificationLogService.facets(),
  ]);
  return NextResponse.json({
    items: page.items.map(toMobileAdminNotificationLog),
    nextCursor: page.nextCursor,
    ...(facets ? { facets } : {}),
  });
}
