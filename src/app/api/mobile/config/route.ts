import { NextResponse } from "next/server";
import { getAppVersionGate } from "@/lib/app-version";
import { toMobileAppConfig } from "@/lib/mobile-dto";
import { getPaymentCopyMode } from "@/lib/payment-copy";
import { getPricingRules } from "@/lib/platform-settings";
import { walletCapabilities } from "@/lib/wallet/config";

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
  /*
    Odeme kipi: metinler saglayicinin yetenegine baglidir (`payment-copy.ts`).
    Tanimsiz saglayici getPaymentProvider'i firlatir; o durumda "onsite" (gercek).
  */
  let paymentMode: "online" | "onsite" = "onsite";
  try {
    paymentMode = getPaymentCopyMode();
  } catch {
    paymentMode = "onsite";
  }
  return NextResponse.json(toMobileAppConfig({ ...gate, requireSealsOnCheckIn, paymentMode, ...walletCapabilities() }));
}
