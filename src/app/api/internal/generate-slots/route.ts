import { NextResponse } from "next/server";
import { fillMissingSlots } from "@/services/SlotService";

export async function GET() {
  try {
    const count = await fillMissingSlots();
    return NextResponse.json({ ok: true, slotsGenerated: count });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: String(error) },
      { status: 500 },
    );
  }
}
