import Iyzipay from 'iyzipay';

/**
 * iyzipay - SDK Yapılandırması
 * Marketplace (Split Payment) işlemleri için iyzico API istemcisini hazırlar.
 */
/** iyzico API tabanı — .env içinde IYZICO_BASE_URL kullanın (IYZICO_URI geriye dönük alias). */
const iyzicoUri =
  process.env.IYZICO_BASE_URL ||
  process.env.IYZICO_URI ||
  "https://sandbox-api.iyzipay.com";

export const iyzipay = new Iyzipay({
  apiKey: process.env.IYZICO_API_KEY || 'sandbox-api-key',
  secretKey: process.env.IYZICO_SECRET_KEY || 'sandbox-secret-key',
  uri: iyzicoUri,
});

export default Iyzipay;
