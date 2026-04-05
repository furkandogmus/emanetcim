/**
 * NextAuth `callbackUrl` — iç bind (0.0.0.0:3000), localhost vb. tam URL’leri
 * yalnızca path + query’ye indirger; open redirect riskini azaltır.
 */
export function sanitizeAuthCallbackUrl(raw: string | null | undefined): string {
  if (raw == null || raw === "") return "/";
  const trimmed = raw.trim();
  if (trimmed.startsWith("/")) {
    if (trimmed.startsWith("//")) return "/";
    return trimmed;
  }

  try {
    const u = new URL(trimmed);
    const host = u.hostname.toLowerCase();
    const bad =
      host === "0.0.0.0" ||
      host === "127.0.0.1" ||
      host === "localhost" ||
      host === "[::1]" ||
      /^192\.168\./.test(host) ||
      /^10\./.test(host) ||
      /^172\.(1[6-9]|2[0-9]|3[0-1])\./.test(host);

    const path = `${u.pathname}${u.search}` || "/";
    if (bad) return path;

    // Dış origin (ör. ngrok): yine de sadece path kullan — tarayıcıdaki gerçek host ile uyumlu
    return path;
  } catch {
    return "/";
  }
}
