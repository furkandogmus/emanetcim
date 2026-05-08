import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { z } from "zod";
import { requireMobileUser, requireRole } from "@/lib/mobile-auth";
import { bookingService } from "@/services/BookingService";

const schema = z.object({
  sealPhotoUrl: z.string().url().nullable().optional(),
  sealAssignments: z.array(z.object({
    sealNumber: z.number().int(),
    bagIndex: z.number().int(),
    bagSize: z.string(),
  })).optional(),
  faultySealNumbers: z.array(z.number().int()).optional(),
});

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireMobileUser(req);
  if ("error" in auth) return auth.error;
  
  const forbid = requireRole(auth.user, ["PARTNER", "ADMIN"]);
  if (forbid) return forbid;

  const { id } = await params;
  const body = await req.json().catch(() => null);
  const parsed = schema.safeParse(body);
  
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid_body", issues: parsed.error.issues }, { status: 400 });
  }

  const result = await bookingService.checkIn(id);

  if (!result.ok) {
    return NextResponse.json({ error: result.code, message: result.message }, { status: 400 });
  }

  return NextResponse.json({ ok: true });
}
