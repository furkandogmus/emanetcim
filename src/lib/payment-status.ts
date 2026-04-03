/**
 * Normalizes iyzico / internal payment status checks (mixed casing).
 */
export function isPaymentSuccess(status: unknown): boolean {
  if (status == null) return false;
  const s = String(status).toLowerCase();
  return s === "success";
}

export function isRefundSuccess(status: unknown): boolean {
  return isPaymentSuccess(status);
}
