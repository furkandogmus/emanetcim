import { NextRequest, NextResponse } from "next/server";
import { getSlotAvailability } from "@/services/SlotService";
import { requireMobileUser } from "@/lib/mobile-auth";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    await requireMobileUser(req);
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id: shopId } = await params;
  const url = new URL(req.url);
  const from = url.searchParams.get("from");
  const to = url.searchParams.get("to");

  if (!from || !to) {
    return NextResponse.json({ error: "Missing from/to query params" }, { status: 400 });
  }

  const fromDate = new Date(from);
  const toDate = new Date(to);

  if (isNaN(fromDate.getTime()) || isNaN(toDate.getTime())) {
    return NextResponse.json({ error: "Invalid date format" }, { status: 400 });
  }

  const slots = await getSlotAvailability(shopId, fromDate, toDate);

  return NextResponse.json(
    { slots },
    {
      headers: {
        "Cache-Control": "public, max-age=30, s-maxage=30",
      },
    },
  );
}
