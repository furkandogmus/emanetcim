import { NextResponse } from "next/server";
import { assetLinks } from "@/lib/app-links";

/** `/.well-known/...` buraya yeniden yazilir (next.config.ts). Bkz. `src/lib/app-links.ts`. */
export const dynamic = "force-dynamic";

export function GET() {
  const body = assetLinks();
  if (!body) return new NextResponse(null, { status: 404 });
  return NextResponse.json(body, { headers: { "Cache-Control": "public, max-age=3600" } });
}
