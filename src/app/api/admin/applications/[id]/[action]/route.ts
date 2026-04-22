import { NextResponse } from "next/server";
import prisma from "@/lib/db";
import { getMobileSession } from "@/lib/mobile-auth";

export async function POST(
  req: Request,
  { params }: { params: { id: string; action: string } }
) {
  const session = await getMobileSession();
  if (!session || session.role !== "ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id, action } = params;

  if (action === "approve") {
    await prisma.shop.update({
      where: { id },
      data: { isActive: true },
    });
  } else if (action === "reject") {
    // For rejection, we can either delete or mark as rejected if we had a status field.
    // Since we only have isActive, deleting is the cleanest if we don't want them in the list.
    await prisma.shop.delete({ where: { id } });
  } else {
    return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  }

  return NextResponse.json({ success: true });
}
