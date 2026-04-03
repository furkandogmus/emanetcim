import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

/** Liveness: süreç ayakta mı (DB yok). K8s / LB probe için düşük maliyet. */
export async function GET() {
  return NextResponse.json(
    { status: "ok", live: true, timestamp: new Date().toISOString() },
    { status: 200 },
  );
}
