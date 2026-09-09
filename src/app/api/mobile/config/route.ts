import { NextResponse } from "next/server";
import { getAppVersionGate } from "@/lib/app-version";
import { toMobileAppConfig } from "@/lib/mobile-dto";

/**
 * Kimlik doğrulama ÖNCESİ (splash ekranı) çağrılabilmesi gerekir — zorunlu
 * güncelleme kapısı girişten önce kontrol edilir, bu yüzden bilinçli olarak
 * `requireMobileUser` YOK.
 */
export async function GET() {
  const gate = await getAppVersionGate();
  return NextResponse.json(toMobileAppConfig(gate));
}
