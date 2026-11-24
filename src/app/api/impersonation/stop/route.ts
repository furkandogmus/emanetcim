import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { clientIpFromRequest } from "@/lib/client-ip";
import { writeAuditLog } from "@/lib/audit-log";
import { WEB_IMPERSONATION_COOKIE, verifyWebImpersonation } from "@/lib/web-impersonation";

/**
 * Web "olarak goruntule"yu bitirir: cerez silinir, bir sonraki istekte oturum yine adminin.
 * `auth()` burada hedefi dondurur; admin kimligi imzali cerezden okunur. Cerezsiz ya da
 * suresi dolmus istekte de 200 (bitirmek her zaman guvenli), ama denetim kaydi yalniz gecerli cerezde.
 */
/** Yalniz kendi sayfalarimizdan: baska site goruntulemeyi bitirip denetim kaydi uretemesin. */
function isSameOrigin(req: NextRequest): boolean {
  const site = req.headers.get("sec-fetch-site");
  if (site && site !== "same-origin") return false;
  const origin = req.headers.get("origin");
  if (!origin) return site === "same-origin";
  const host = req.headers.get("x-forwarded-host") ?? req.headers.get("host");
  try {
    return !!host && new URL(origin).host === host.split(",")[0].trim();
  } catch {
    return false;
  }
}

export async function POST(req: NextRequest) {
  if (!isSameOrigin(req)) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  const claims = await verifyWebImpersonation(req.cookies.get(WEB_IMPERSONATION_COOKIE)?.value);
  if (claims) {
    writeAuditLog({
      actorUserId: claims.adminId,
      actorRole: "ADMIN",
      action: "admin.impersonate.stop",
      entityType: "User",
      entityId: claims.targetId,
      metadata: { channel: "web" },
      ip: clientIpFromRequest(req),
    });
  }
  const res = NextResponse.json({ ok: true });
  res.cookies.delete({ name: WEB_IMPERSONATION_COOKIE, path: "/" });
  return res;
}
