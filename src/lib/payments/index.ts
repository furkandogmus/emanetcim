import { ManualPaymentProvider } from "./manual";
import type { PaymentProvider } from "./types";

export * from "./types";
export { ManualPaymentProvider } from "./manual";

const REGISTRY: Record<string, () => PaymentProvider> = {
  manual: () => new ManualPaymentProvider(),
};

let cached: PaymentProvider | null = null;

/**
 * Aktif sağlayıcıyı `PAYMENT_PROVIDER` ortam değişkeninden çözer.
 *
 * Bilinmeyen bir değerde SESSİZCE manuel'e düşmez, atar. Sebep: "iyzico yazdım
 * ama adaptör yok" durumunda sistemin dükkanda-tahsilat moduna sessizce geçmesi,
 * tam olarak bu projeyi bu hale getiren hata sınıfıdır (yanlış varsayılan =
 * gerçekmiş gibi görünen para).
 */
export function getPaymentProvider(): PaymentProvider {
  if (cached) return cached;
  const id = (process.env.PAYMENT_PROVIDER ?? "manual").trim().toLowerCase();
  const factory = REGISTRY[id];
  if (!factory) {
    throw new Error(
      `Unknown PAYMENT_PROVIDER "${id}". Available: ${Object.keys(REGISTRY).join(", ")}`,
    );
  }
  cached = factory();
  return cached;
}

/** Yalnızca test içindir. */
export function __resetPaymentProviderCache(): void {
  cached = null;
}
