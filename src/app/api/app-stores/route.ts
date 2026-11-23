import { NextResponse } from "next/server";
import { getAppStoreFlags } from "@/lib/app-stores";

/**
 * Hangi magaza yayinda — altbilgi rozetleri icin. Altbilgi kok layout'ta ve
 * cogu sayfa build aninda (veritabani olmadan) statik uretiliyor; bayrak oraya
 * gomulseydi, ac/kapa bir sonraki deploy'a kadar gorunmezdi.
 */
export const dynamic = "force-dynamic";

export async function GET() {
  const flags = await getAppStoreFlags();
  return NextResponse.json(flags, {
    headers: { "Cache-Control": "public, max-age=60, s-maxage=60" },
  });
}
