import { NextResponse } from "next/server";
import { getMobileSession } from "@/lib/mobile-auth";
import { clientIpFromRequest } from "@/lib/client-ip";
import { applicationActionResponse } from "@/lib/admin-application-response";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string; action: string }> }
) {
  const session = await getMobileSession();
  if (!session || session.role !== "ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id, action } = await params;
  /*
    Govde `applicationActionResponse`te (2026-10-18): onay e-postasi, muhur
    iadesi ve denetim kaydi `ShopService.approveApplication`/`rejectApplication`
    icinde. Bu uc ile mobil uc ayni govdeyi iki kez yaziyordu ve ikisi de
    denetim kaydini atliyordu.
  */
  return applicationActionResponse(id, action, {
    userId: session.userId,
    ip: clientIpFromRequest(req),
  });
}
