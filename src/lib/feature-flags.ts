/**
 * Üretim özellik bayrakları (env tabanlı).
 */

/** false ise iyzico ödeme init, webhook işleme ve iade çağrıları devre dışı (bakım / yumuşak kapanış). */
export function isPaymentsEnabled(): boolean {
  return process.env.PAYMENTS_ENABLED?.trim() !== "false";
}
