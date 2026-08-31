import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import prisma from "@/lib/db";
import { requireMobileUser, requireRole } from "@/lib/mobile-auth";
import { sealService } from "@/services/SealService";

export async function POST(req: NextRequest) {
  const auth = await requireMobileUser(req);
  if ("error" in auth) return auth.error;
  const roleErr = requireRole(auth.user, ["PARTNER"]);
  if (roleErr) return roleErr;

  // Cagiran partner'in KENDI dukkani — mühür sahipligi buna gore dogrulanir.
  const shop = await prisma.shop.findFirst({
    where: { ownerId: auth.user.id, isActive: true },
  });
  if (!shop) return NextResponse.json({ error: "no_shop" }, { status: 404 });

  const { serialNumber } = await req.json();
  const serial = Number(serialNumber);
  if (!serialNumber || !Number.isInteger(serial)) {
    return NextResponse.json({ error: "invalid_data" }, { status: 400 });
  }

  try {
    // Bu uc eskiden mühürü dogrudan serialNumber ile bulup FAULTY yapiyordu; seri
    // numaralari 1..2000 araliginda ardisik integer oldugundan herhangi bir partner
    // sistemdeki TUM mühürleri arizali isaretleyebiliyordu — ve FAULTY bir mühür
    // check-in'de reddedildiginden (SealService:122) bu, platform genelinde check-in'i
    // durdururdu. markSealAsFaulty sahiplik ve durum kontrollerini zaten iceriyor.
    await sealService.markSealAsFaulty(serial, shop.id, {
      id: auth.user.id,
      role: auth.user.role,
    });
    return NextResponse.json({ success: true });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "";
    if (msg === "shop_not_owned_by_actor" || msg === "seal_not_owned_by_shop") {
      return NextResponse.json({ error: "not_found" }, { status: 404 });
    }
    if (msg === "seal_already_processed") {
      return NextResponse.json({ error: "seal_already_processed" }, { status: 409 });
    }
    return NextResponse.json({ error: "server_error" }, { status: 500 });
  }
}
