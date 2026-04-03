import Iyzipay from 'iyzipay';

/**
 * iyzipay - SDK Yapılandırması
 * Production'da IYZICO_* yoksa modül yüklenirken hata verir (requireProdSecrets ile uyumlu).
 */
const iyzicoUri =
  process.env.IYZICO_BASE_URL ||
  process.env.IYZICO_URI ||
  'https://sandbox-api.iyzipay.com';

const apiKey = process.env.IYZICO_API_KEY?.trim();
const secretKey = process.env.IYZICO_SECRET_KEY?.trim();

if (process.env.NODE_ENV === 'production') {
  if (!apiKey || !secretKey) {
    throw new Error(
      'IYZICO_API_KEY and IYZICO_SECRET_KEY are required in production (see src/lib/iyzipay.ts)'
    );
  }
}

export const iyzipay = new Iyzipay({
  apiKey: apiKey || 'sandbox-api-key',
  secretKey: secretKey || 'sandbox-secret-key',
  uri: iyzicoUri,
});

export default Iyzipay;
