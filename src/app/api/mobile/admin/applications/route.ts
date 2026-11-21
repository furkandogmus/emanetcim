import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { requireMobileUser, requireRole } from "@/lib/mobile-auth";
import prisma from "@/lib/db";
import { PENDING_APPLICATION_WHERE } from "@/lib/pending-application";
import { toMobileAdminApplication } from "@/lib/mobile-dto";

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const auth = await requireMobileUser(req);
  if ("error" in auth) return auth.error;
  const forbid = requireRole(auth.user, ["ADMIN"]);
  if (forbid) return forbid;

  const apps = await prisma.shop.findMany({
    where: PENDING_APPLICATION_WHERE,
    include: {
      owner: {
        select: { name: true, phone: true, email: true },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json(apps.map(toMobileAdminApplication));
}
