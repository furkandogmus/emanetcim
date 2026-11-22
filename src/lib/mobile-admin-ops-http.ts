import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

/** Yonetim araclari uclarinin ortak hata/govde yardimcilari. Kurallar serviste. */
export async function readOpsBody(req: NextRequest): Promise<Record<string, unknown>> {
  const json: unknown = await req.json().catch(() => null);
  return json && typeof json === "object" && !Array.isArray(json) ? (json as Record<string, unknown>) : {};
}

const STATUS: Record<string, number> = {
  not_found: 404,
  duplicate_code: 409,
  confirmation_required: 428,
};

export function opsError(code: string, extra: Record<string, unknown> = {}) {
  return NextResponse.json({ error: code, ...extra }, { status: STATUS[code] ?? 400 });
}
