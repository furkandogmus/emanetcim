import { getPaymentProvider } from "@/lib/payments";
import { getPricingRules } from "@/lib/platform-settings";
import { effectiveCommissionRate, getMerchantShareRatio } from "@/lib/platform-split";

/**
 * Bugün GERÇEKTEN uygulanan komisyon oranı — tek okuma noktası.
 *
 * `PlatformSettings.platformCommissionRate`i doğrudan okuyan her yer, platformun
 * tahsilat yapıp yapmadığını da kontrol etmek zorunda kalırdı; bir tanesi unutulsa
 * esnafa yine olmayan bir kesinti gösterilirdi. Kural `effectiveCommissionRate`te,
 * çağrılma biçimi burada.
 *
 * Bkz. `platform-split.ts` → `effectiveCommissionRate`.
 */
export async function getEffectiveCommission(): Promise<{
  /** Uygulanan oran. Dükkanda tahsilatta 0. */
  rate: number;
  /** Ayarda yazan oran — PSP bağlanınca yürürlüğe girecek olan. */
  configuredRate: number;
  /** Esnafın brütten aldığı pay. Dükkanda tahsilatta 1. */
  merchantShareRatio: number;
  /** Platform parayı kendi topluyor mu? */
  capturesOnline: boolean;
}> {
  const [rules, provider] = await Promise.all([
    getPricingRules(),
    Promise.resolve(getPaymentProvider()),
  ]);
  const capturesOnline = provider.capabilities.capturesOnline;
  const rate = effectiveCommissionRate(rules.platformCommissionRate, capturesOnline);
  return {
    rate,
    configuredRate: rules.platformCommissionRate,
    merchantShareRatio: getMerchantShareRatio(rate),
    capturesOnline,
  };
}
