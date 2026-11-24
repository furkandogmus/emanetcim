import { NextResponse } from "next/server";
import type { Session } from "next-auth";

/**
 * Route handler'larin web "olarak goruntule" kilidi. Proxy de keser; bu, proxy'nin
 * yolu farkli gordugu (kodlama, matcher) durumlar icin ikinci kilit. Stale oturum da sayilir.
 */
export function rejectIfImpersonating(session: Session | null | undefined): NextResponse | null {
  return session?.impersonation
    ? NextResponse.json({ error: "not_allowed_while_impersonating" }, { status: 403 })
    : null;
}
