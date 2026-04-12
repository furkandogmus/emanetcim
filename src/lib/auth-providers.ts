/**
 * OAuth sağlayıcıları sunucuda kayıtlı mı — UI ile auth.config aynı koşulu kullanır.
 */
export function isAppleOAuthConfigured(): boolean {
  return !!(
    process.env.APPLE_ID?.trim() && process.env.APPLE_SECRET?.trim()
  );
}

/** Yerel geliştirme veya açıkça açılmış staging: hızlı demo girişleri. */
export function isAuthDemoUiEnabled(): boolean {
  if (process.env.NODE_ENV !== "production") return true;
  return process.env.NEXT_PUBLIC_ENABLE_AUTH_DEMO?.trim() === "true";
}
