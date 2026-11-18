import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getClientIp } from "@/lib/get-ip";
import { toMobileCity } from "@/lib/mobile-dto";
import { rateLimit } from "@/lib/rate-limit";
import { cityCoverageService } from "@/services/CityCoverageService";

/** Dukkani olan sehirler (oturum gerekmez; giris oncesi de gosterilebilir). */
export async function GET(req: NextRequest) {
  const ip = await getClientIp(req);
  if (!(await rateLimit(`mobile_cities:${ip}`, 30, 60_000))) {
    return NextResponse.json({ error: "too_many_requests" }, { status: 429 });
  }
  const cities = await cityCoverageService.list();
  return NextResponse.json({ cities: cities.map(toMobileCity) });
}
