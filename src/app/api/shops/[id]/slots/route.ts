import { NextRequest } from "next/server";
import { handleSlotAvailability } from "@/lib/slot-availability-route";

/** Slot müsaitliği herkese açıktır: misafir, giriş yapmadan slot seçer. */
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return handleSlotAvailability(req, params);
}
