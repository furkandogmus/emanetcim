import { randomUUID } from "crypto";
import type {
  PaymentProvider,
  PaymentCapabilities,
  PaymentIntentInput,
  PaymentIntentResult,
  PaymentRefundInput,
  PaymentRefundResult,
} from "./types";

/**
 * LANSMAN ADAPTÖRÜ — dükkanda tahsilat (nakit / esnafın kendi POS'u).
 *
 * NEDEN BU: şahıs şirketi kurulup PSP entegrasyonu tamamlanana kadar online
 * tahsilat yok. Bunu "yokmuş gibi" davranarak gizlemek yerine birinci sınıf bir
 * sağlayıcı olarak modelliyoruz. Maliyet tarafı da bunu destekliyor: PSP komisyonu
 * (~%2,5 + işlem ücreti) lansmanda sıfır, entegrasyon/uyum işi sonraya kalıyor.
 *
 * Tek ama kritik kural: para HAREKETİ burada olmaz, yalnızca KAYIT olur. Tahsilat
 * fiziksel; bu adaptör onu deftere işleyip denetlenebilir kılar. `capturesOnline`
 * false olduğu için kamuya açık metinler otomatik olarak "kartla ödeme" vaadi
 * vermez (bkz. `PaymentCapabilities`).
 */
export class ManualPaymentProvider implements PaymentProvider {
  readonly capabilities: PaymentCapabilities = {
    id: "manual",
    capturesOnline: false,
    supportsCardRefund: false,
    supportsSplit: false,
  };

  async createIntent(input: PaymentIntentInput): Promise<PaymentIntentResult> {
    // Sağlayıcı tarafı yok; referans yalnızca defterle eşleşme için üretiliyor.
    return {
      providerRef: `manual_${input.bookingId}`,
      redirectUrl: null,
      capturedImmediately: false,
    };
  }

  async capture(input: {
    bookingId: string;
    providerRef: string | null;
    amountMinor: number;
    currency: string;
  }): Promise<{ providerRef: string | null; transactionId: string | null }> {
    // Dükkandaki tahsilatın makbuz numarası yerine geçen iz.
    return {
      providerRef: input.providerRef ?? `manual_${input.bookingId}`,
      transactionId: `manual_cap_${randomUUID()}`,
    };
  }

  async refund(input: PaymentRefundInput): Promise<PaymentRefundResult> {
    // İade de fiziksel: para dükkanda/havale ile geri verilir. `settled: false`
    // bilerek — defter satırı "iade edilmesi gereken" durumuna geçer, operasyon
    // tamamlayana kadar kapanmış sayılmaz.
    return {
      providerRef: input.providerRef,
      settled: false,
    };
  }
}
