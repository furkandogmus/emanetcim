import { NextResponse } from "next/server";
import type { AdminMailResult } from "@/services/AdminUserService";

const STATUS: Record<Extract<AdminMailResult, { ok: false }>["error"], number> = {
  not_found: 404,
  no_email: 409,
  invalid_email: 409,
  already_verified: 409,
};

/** Sifirlama ve dogrulama e-postasi uclarinin ortak hata yaniti. */
export function adminMailErrorResponse(error: keyof typeof STATUS) {
  return NextResponse.json({ error }, { status: STATUS[error] });
}
