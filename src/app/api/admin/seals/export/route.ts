import { NextResponse } from "next/server";
import { auth } from "@/auth";
import prisma from "@/lib/db";

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

  const escape = (s: string) => `"${s.replace(/"/g, '""')}"`;
  const lines = [
    "id,shopName,quantity,status,createdAt",
    ...rows.map((r) =>
      [
        r.id,
        escape(r.shop.name),
        r.quantity,
        r.status,
        r.createdAt.toISOString(),
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
