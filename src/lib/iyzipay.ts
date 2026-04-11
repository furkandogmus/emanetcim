import Iyzipay from "iyzipay";

/**
 * iyzipay - SDK Yapılandırması
 * Üretim anahtarları modül yüklenirken doğrulanmaz; ödeme çağrılarından önce
 * `assertIyzicoKeys()` ile kontrol edilir (next build placeholder ile kırılmaz).
 */
const iyzicoUri =
  process.env.IYZICO_BASE_URL ||
  process.env.IYZICO_URI ||
  "https://sandbox-api.iyzipay.com";

export function assertIyzicoKeys(): void {
  if (process.env.NODE_ENV !== "production") return;
  const k = process.env.IYZICO_API_KEY?.trim();
  const s = process.env.IYZICO_SECRET_KEY?.trim();
  if (!k || !s) {
    throw new Error(
      "IYZICO_API_KEY and IYZICO_SECRET_KEY are required in production (see src/lib/iyzipay.ts)",
    );
  }
}

// Boş string (ör. docker .env'te IYZICO_API_KEY=) ?? ile yedeklenmez; Iyzipay ctor modül yüklenirken hata verir.
const apiKey = process.env.IYZICO_API_KEY?.trim() || "sandbox-api-key";
const secretKey = process.env.IYZICO_SECRET_KEY?.trim() || "sandbox-secret-key";

export const iyzipay = new Iyzipay({
  apiKey,
  secretKey,
  uri: iyzicoUri,
});
