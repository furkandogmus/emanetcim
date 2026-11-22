import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import type { MobileActor } from "@/lib/mobile-auth";

/**
 * Goruntuleme oturumunda kapali. Sozlesme `forbidden` der (`not_allowed_while_impersonating` degil):
 * istemci tek kodla "yetkin yok" gosterir.
 */
export function forbidWhileImpersonatingBroadcast(user: MobileActor) {
  return user.impersonatedBy ? NextResponse.json({ error: "forbidden" }, { status: 403 }) : null;
}

export async function readObjectBody(req: NextRequest): Promise<Record<string, unknown>> {
  const json: unknown = await req.json().catch(() => null);
  return json && typeof json === "object" && !Array.isArray(json) ? (json as Record<string, unknown>) : {};
}

const STATUS: Record<string, number> = { forbidden: 403, too_soon: 429, broadcast_in_progress: 409 };

export function broadcastError(code: string, extra: Record<string, unknown> = {}) {
  return NextResponse.json({ error: code, ...extra }, { status: STATUS[code] ?? 400 });
}
