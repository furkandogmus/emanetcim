import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { auth } from "@/auth";
import { unpaidCommissionsCsv } from "@/services/AffiliateService";

/** Yonetici: odenmemis araci komisyonlari CSV (`?month=2026-11` istege bagli). */
export async function GET(req: NextRequest) {
  // /api/** proxy'nin rol kapisindan gecmez: kapi burada (`admin-api-self-gate`).
  const session = await auth();
  if (session?.user?.role !== "ADMIN") return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const month = req.nextUrl.searchParams.get("month") ?? undefined;
  if (month && !/^\d{4}-\d{2}$/.test(month)) return NextResponse.json({ error: "invalid_data" }, { status: 400 });
  const csv = await unpaidCommissionsCsv({ month });
  return new NextResponse(csv, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="araci-komisyon-${month ?? "tum"}.csv"`,
      "Cache-Control": "no-store",
    },
  });
}
