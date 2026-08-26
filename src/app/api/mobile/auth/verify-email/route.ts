import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { verifyEmailToken, type VerifyEmailErrorCode } from "@/services/auth/verify-email";

/**
 * Servis kodunun mobil HTTP karsiligi. Istemcinin gordugu kodlar DEGISMEDI;
 * degisen tek sey, govdenin web sayfasiyla PAYLASILIYOR olmasi.
 */
const CODE_TO_HTTP: Record<VerifyEmailErrorCode, { status: number; error: string }> = {
  INVALID_TOKEN: { status: 400, error: "invalid_data" },
  TOKEN_NOT_FOUND: { status: 400, error: "token_not_found" },
  TOKEN_EXPIRED: { status: 400, error: "token_expired" },
  USER_NOT_FOUND: { status: 404, error: "user_not_found" },
  UNKNOWN: { status: 500, error: "server_error" },
};

export async function POST(req: NextRequest) {
  const { token } = await req.json().catch(() => ({ token: undefined }));

  const result = await verifyEmailToken(token);
  if (!result.ok) {
    const { status, error } = CODE_TO_HTTP[result.code];
    return NextResponse.json({ error }, { status });
  }

  return NextResponse.json({ success: true });
}
