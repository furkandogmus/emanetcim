import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getClientIp } from "@/lib/get-ip";
import { toMobileDistrict } from "@/lib/mobile-dto";
import { rateLimit } from "@/lib/rate-limit";
import { cityCoverageService } from "@/services/CityCoverageService";

/**
 * Sehrin dukkani olan ilceleri (oturum gerekmez). `city`, `/cities` yanitindaki `slug`;
 * bilinmeyen sehirde 404 degil bos liste: istemci ilce adimini atlar ve sehirle arar.
 */
export async function GET(req: NextRequest, { params }: { params: Promise<{ city: string }> }) {
  const ip = await getClientIp(req);
  if (!(await rateLimit(`mobile_districts:${ip}`, 30, 60_000))) {
    return NextResponse.json({ error: "too_many_requests" }, { status: 429 });
  }
  const { city } = await params;
  const districts = await cityCoverageService.districts(city);
  return NextResponse.json({ districts: districts.map(toMobileDistrict) });
}
