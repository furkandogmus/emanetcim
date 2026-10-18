import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { requireMobileUser, requireRole } from "@/lib/mobile-auth";
import { replyToContactMessage } from "@/services/ContactReplyService";

const STATUS = {
  invalid_input: 400,
  too_many_requests: 429,
  not_found: 404,
  email_send_failed: 502,
} as const;

/**
 * Mobil admin: destek mesajına e-postayla cevap. Gövde web paneliyle aynı
 * `ContactReplyService`; bu uç yalnızca yetki ve HTTP eşlemesi yapar.
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireMobileUser(req);
  if ("error" in auth) return auth.error;
  const forbid = requireRole(auth.user, ["ADMIN"]);
  if (forbid) return forbid;

  const { id } = await params;
  const json: unknown = await req.json().catch(() => null);
  const body =
    json && typeof json === "object" && "body" in json && typeof json.body === "string"
      ? json.body
      : "";

  const result = await replyToContactMessage({ messageId: id, body, actorId: auth.user.id });
  if (!result.ok) {
    return NextResponse.json({ error: result.code }, { status: STATUS[result.code] });
  }
  return NextResponse.json({ reply: result.reply });
}
