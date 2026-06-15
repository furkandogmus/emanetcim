import { NextRequest, NextResponse } from "next/server";
import { getSlotAvailability } from "@/services/SlotService";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id: shopId } = await params;
  const url = new URL(_req.url);
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
