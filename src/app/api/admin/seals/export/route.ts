import { NextResponse } from "next/server";
import { auth } from "@/auth";
import prisma from "@/lib/db";
import { csvCell } from "@/lib/csv";

/**
 * Admin: mühür taleplerini CSV indir.
 */
export async function GET() {
  const session = await auth();
  if (session?.user?.role !== "ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const rows = await prisma.sealRequest.findMany({
    include: { shop: true },
    orderBy: { createdAt: "desc" },
  });

  const lines = [
    "id,shopName,quantity,status,createdAt",
    ...rows.map((r) =>
      [
        csvCell(r.id),
        csvCell(r.shop.name),
        csvCell(r.quantity),
        csvCell(r.status),
        csvCell(r.createdAt.toISOString()),
      ].join(",")
    ),
  ];

  const csv = "\uFEFF" + lines.join("\n");

  return new NextResponse(csv, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": 'attachment; filename="mühür-talepleri.csv"',
    },
  });
}
