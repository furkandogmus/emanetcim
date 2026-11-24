import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { teamGate } from "@/lib/mobile-shop-team";
import { revokeInvite } from "@/services/ShopStaffService";

/** DELETE: bekleyen daveti geri alir; bag artik calismaz. */
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const gate = await teamGate(req, { write: true });
  if ("error" in gate) return gate.error;
  const { id } = await params;
  const revoked = await revokeInvite(gate.user, gate.shop.id, id);
  if (!revoked) return NextResponse.json({ error: "not_found" }, { status: 404 });
  return NextResponse.json({ success: true });
}
