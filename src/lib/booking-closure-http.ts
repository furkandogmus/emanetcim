import { NextResponse } from "next/server";
import type { ClosureErrorCode, ClosureResult } from "@/services/booking/closure";

/** Mobil sozlesme: servis kodu -> `{ error }` + HTTP durumu. Dort kapanis ucu ortak kullanir. */
const CLOSURE_HTTP: Record<ClosureErrorCode, { error: string; status: number }> = {
  NOT_FOUND: { error: "not_found", status: 404 },
  FORBIDDEN: { error: "forbidden", status: 403 },
  INVALID_STATUS: { error: "invalid_status", status: 400 },
  NOTE_REQUIRED: { error: "note_required", status: 400 },
  INVALID_REASON: { error: "invalid_reason", status: 400 },
  TOO_EARLY: { error: "too_early", status: 400 },
  UNKNOWN: { error: "server_error", status: 500 },
};

export function closureResponse(result: ClosureResult): NextResponse {
  if (result.ok) return NextResponse.json({ success: true });
  const { error, status } = CLOSURE_HTTP[result.code];
  return NextResponse.json({ error }, { status });
}

/** Bozuk ya da bos govde `{}` sayilir; alan kapilari servis tarafinda. */
export async function readJsonBody(req: Request): Promise<Record<string, unknown>> {
  const body: unknown = await req.json().catch(() => ({}));
  return body && typeof body === "object" ? (body as Record<string, unknown>) : {};
}
