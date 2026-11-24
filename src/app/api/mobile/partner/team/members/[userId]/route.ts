import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { teamGate } from "@/lib/mobile-shop-team";
import { removeStaff } from "@/services/ShopStaffService";

/** DELETE: personeli cikarir; erisimi bir sonraki istekte biter. */
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ userId: string }> }) {
  const gate = await teamGate(req, { write: true });
  if ("error" in gate) return gate.error;
  const { userId } = await params;
  const removed = await removeStaff(gate.user, gate.shop.id, userId);
  if (!removed) return NextResponse.json({ error: "not_found" }, { status: 404 });
  return NextResponse.json({ success: true });
}
