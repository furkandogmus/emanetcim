import { NextResponse } from "next/server";
import { getAppVersionGate } from "@/lib/app-version";
import { toMobileAppConfig } from "@/lib/mobile-dto";
import { getPricingRules } from "@/lib/platform-settings";

/**
 * Kimlik doğrulama ÖNCESİ (splash ekranı) çağrılabilmesi gerekir — zorunlu
 * güncelleme kapısı girişten önce kontrol edilir, bu yüzden bilinçli olarak
 * `requireMobileUser` YOK.
 */
export async function GET() {
  const gate = await getAppVersionGate();
  /*
    Muhur zorunlulugu: istemci derleme anindaki sabite (`SEALS_ENABLED`) degil
    sunucudaki ayara bakar. Okunamazsa kapali varsayilir (ayarin varsayilani).
  */
  const requireSealsOnCheckIn = await getPricingRules()
    .then((r) => r.requireSealsOnCheckIn === true)
    .catch(() => false);
  return NextResponse.json(toMobileAppConfig({ ...gate, requireSealsOnCheckIn }));
}
