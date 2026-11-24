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
export async function POST(req: NextRequest) {
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
