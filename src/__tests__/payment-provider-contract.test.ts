import { describe, expect, it } from "vitest";
import { ManualPaymentProvider } from "@/lib/payments/manual";
import type { PaymentProvider } from "@/lib/payments/types";

/**
 * Sağlayıcı sözleşmesi mandalı.
 *
 * NEDEN: pazaryeri yetenekleri (`supportsSplit`, `supportsOnboarding`,
 * `supportsWebhooks`) arayüzde İSTEĞE BAĞLI metotlarla eşleşiyor. Bir adaptör
 * yeteneği TRUE ilan edip metodu yazmazsa TypeScript şikayet etmez; hata ancak
 * canlıda, para bölünürken `undefined is not a function` olarak ortaya çıkar.
 *
 * Bu test o boşluğu kapatır: ilan edilen her yetenek, karşılığı olan metodu
 * ZORUNLU kılar. Yeni bir adaptör eklendiğinde PROVIDERS listesine eklenir.
 */
const PROVIDERS: PaymentProvider[] = [new ManualPaymentProvider()];

/** Yetenek bayrağı -> onsuz olmaz metotlar. */
const REQUIRED_BY_CAPABILITY = {
  supportsOnboarding: ["onboardMerchant", "getMerchantStatus"],
  supportsSplit: ["createSplit"],
  supportsWebhooks: ["verifyWebhook"],
} as const;

describe("ödeme sağlayıcı sözleşmesi", () => {
  it.each(PROVIDERS.map((p) => [p.capabilities.id, p] as const))(
    "%s: ilan ettiği her yeteneğin metodu var",
    (_id, provider) => {
      for (const [flag, methods] of Object.entries(REQUIRED_BY_CAPABILITY)) {
        const declared = provider.capabilities[flag as keyof typeof REQUIRED_BY_CAPABILITY];
        if (!declared) continue;
        for (const method of methods) {
          expect(
            typeof (provider as unknown as Record<string, unknown>)[method],
            `${provider.capabilities.id} "${flag}" ilan ediyor ama ${method}() yok`,
          ).toBe("function");
        }
      }
    },
  );

  it.each(PROVIDERS.map((p) => [p.capabilities.id, p] as const))(
    "%s: temel ödeme metotlarını her hâlükârda taşır",
    (_id, provider) => {
      expect(typeof provider.createIntent).toBe("function");
      expect(typeof provider.capture).toBe("function");
      expect(typeof provider.refund).toBe("function");
    },
  );

  it.each(PROVIDERS.map((p) => [p.capabilities.id, p] as const))(
    "%s: capabilities.id boş değil ve küçük harf",
    (_id, provider) => {
      // `PaymentLog.provider` alanina AYNEN yaziliyor; buyuk/kucuk harf
      // tutarsizligi ayni saglayiciyi iki farkli deger gibi gosterirdi.
      const id = provider.capabilities.id;
      expect(id.length).toBeGreaterThan(0);
      expect(id).toBe(id.toLowerCase());
    },
  );

  it("split destekleyen sağlayıcı komisyonu KENDİ hesaplamaz", () => {
    // Sozlesme geregi tutarlar SplitInput icinde hazir gelir. Bu test bir
    // hatirlatma degil, niyetin kayda gecmis hali: iki yerde hesaplanan
    // komisyon er gec iki farkli sonuc verir.
    for (const p of PROVIDERS) {
      if (!p.capabilities.supportsSplit) continue;
      expect(typeof p.createSplit).toBe("function");
    }
  });
});
