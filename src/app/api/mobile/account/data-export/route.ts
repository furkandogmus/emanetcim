import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { z } from "zod";
import { clientIpFromRequest } from "@/lib/client-ip";
import { forbidWhileImpersonating, requireMobileUser } from "@/lib/mobile-auth";
import { dataExportEmailResponse } from "@/lib/data-export-response";
import { accountDataExportService } from "@/services/AccountDataExportService";

const BodySchema = z.object({ locale: z.string().max(8).optional() });

/** KVKK dışa aktarımı e-postayla (her rol). Gövde web `POST /api/account/data-export` ile aynı servis. */
export async function POST(req: NextRequest) {
  const auth = await requireMobileUser(req);
  if ("error" in auth) return auth.error;
  // Yonetici goruntulemesinde misafirin verisi onun kutusuna bile olsa gonderilmez.
  const blocked = forbidWhileImpersonating(auth.user);
  if (blocked) return blocked;

  const parsed = BodySchema.safeParse((await req.json().catch(() => ({}))) ?? {});
  if (!parsed.success) return NextResponse.json({ error: "invalid_data" }, { status: 400 });

  const result = await accountDataExportService.emailExport({
    userId: auth.user.id,
    role: auth.user.role,
    locale: parsed.data.locale,
    ip: clientIpFromRequest(req),
    channel: "mobile",
  });
  return dataExportEmailResponse(result);
}
