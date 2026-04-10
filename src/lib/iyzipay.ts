import Iyzipay from 'iyzipay';

/**
 * iyzipay - SDK Yapılandırması
 * Marketplace (Split Payment) işlemleri için iyzico API istemcisini hazırlar.
 */
const iyzicoUri =
  process.env.IYZICO_URI ||
  process.env.IYZICO_BASE_URL ||
  'https://sandbox-api.iyzipay.com';

// Guard runs at request-time (inside a function) rather than at module-load
// time so that `next build` — which runs with NODE_ENV=production but needs
// no real credentials — does not throw during the build phase.
export function assertIyzicoKeys(): void {
  if (process.env.NODE_ENV === 'production') {
    if (!process.env.IYZICO_API_KEY) throw new Error('IYZICO_API_KEY is required in production');
    if (!process.env.IYZICO_SECRET_KEY) throw new Error('IYZICO_SECRET_KEY is required in production');
  }
}

export const iyzipay = new Iyzipay({
  apiKey: process.env.IYZICO_API_KEY ?? 'sandbox-api-key',
  secretKey: process.env.IYZICO_SECRET_KEY ?? 'sandbox-secret-key',
  uri: iyzicoUri,
});
