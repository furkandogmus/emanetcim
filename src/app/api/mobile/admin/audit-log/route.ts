import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { parseCursor } from "@/lib/cursor-page";
import { requireMobileUser, requireRole } from "@/lib/mobile-auth";
import { toMobileAdminAuditEntry } from "@/lib/mobile-dto";
import { auditLogService } from "@/services/AuditLogService";

/** `user.` gibi bir onek ya da tam eylem adi; baska karakter filtreye girmez. */
const PREFIX_RE = /^[a-z_]{1,40}(\.[a-z_]{0,40}){0,3}$/;

/**
 * Denetim kaydi (salt okuma). `?action=<onek>` `?userId=<id>` `?cursor=`.
 * Sorgu web sayfasiyla ortak: `AuditLogService.listPage`. Ilk sayfa filtre
 * oneklerini de tasir.
 */
export async function GET(req: NextRequest) {
  const auth = await requireMobileUser(req);
  if ("error" in auth) return auth.error;
  const forbid = requireRole(auth.user, ["ADMIN"]);
  if (forbid) return forbid;

  const sp = req.nextUrl.searchParams;
  const rawPrefix = (sp.get("action") ?? "").trim();
  const actionPrefix = PREFIX_RE.test(rawPrefix) ? rawPrefix : null;
  const userId = parseCursor(sp.get("userId"));
  const cursor = parseCursor(sp.get("cursor"));

  const [page, options] = await Promise.all([
    auditLogService.listPage({ actionPrefix, userId }, { cursor, take: 30 }),
    cursor ? null : auditLogService.filterOptions(),
  ]);
  return NextResponse.json({
    entries: page.items.map(toMobileAdminAuditEntry),
    nextCursor: page.nextCursor,
    ...(options ? { prefixes: options.actionPrefixes } : {}),
  });
}
