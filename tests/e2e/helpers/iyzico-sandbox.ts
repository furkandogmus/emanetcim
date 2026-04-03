/**
 * iyzico sandbox test kartları — kaynak:
 * https://docs.iyzico.com/en/add-ons/test-cards
 *
 * Gerçek API çağrısı için `PaymentService` dev bypass’ının kapalı olması gerekir:
 * `IYZICO_API_KEY` tanımlı ve `sandbox-api-key` olmamalı (bkz. `src/services/PaymentService.ts`).
 */

/** Dev bypass veya placeholder anahtar kullanılıyorsa gerçek sandbox ödemesi yapılmaz. */
export function isRealIyzicoSandboxConfigured(): boolean {
  const apiKey = process.env.IYZICO_API_KEY;
  const secret = process.env.IYZICO_SECRET_KEY;
  if (!apiKey || apiKey === 'sandbox-api-key') return false;
  if (!secret || secret === 'sandbox-secret-key') return false;
  return true;
}

/** “Successful Response” örnekleri (16 haneli; Amex hariç). */
export const IYZICO_SANDBOX_SUCCESS = {
  HALKBANK_MC_CREDIT: '5528790000000008',
  AKBANK_MC_DEBIT: '5890040000000016',
  DENIZBANK_VISA_DEBIT: '4766620000000001',
  QNB_MC_CREDIT: '5311570000000005',
  VAKIF_VISA_CREDIT: '4157920000000002',
} as const;

/**
 * “Specific Error Generators” — iyzico sandbox’ta bu kartlar ilgili hatayı üretir.
 * Dev bypass açıkken bu kartlarla da ödeme “başarılı” simüle edilir; gerçek senaryo için bypass kapalı olmalı.
 */
export const IYZICO_SANDBOX_ERRORS = {
  NOT_SUFFICIENT_FUNDS: '4111111111111129',
  DO_NOT_HONOUR: '4129111111111111',
  INVALID_TRANSACTION: '4128111111111112',
  EXPIRED_CARD: '4125111111111115',
  INVALID_CVC2: '4124111111111116',
  NOT_PERMITTED_TO_CARDHOLDER: '4123111111111117',
  FRAUD_SUSPECT: '4121111111111119',
  GENERAL_ERROR: '4130111111111118',
  THREEDS_INIT_FAILED: '4151111111111112',
} as const;
