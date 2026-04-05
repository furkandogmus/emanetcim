/**
 * OAuth (Google vb.) için Auth.js’in kullandığı kamu kök URL’si (`AUTH_URL` / `NEXTAUTH_URL`).
 *
 * Öncelik: `AUTH_PUBLIC_HOST` (veya `PUBLIC_HOSTNAME`, `AUTH_HOSTNAME`) — host veya `host:port`.
 * Production’da yoksa `HOSTNAME` kullanılır; nokta içermeyen kısa id’ler (Docker konteyner adı) yok sayılır.
 * Development’ta yalnızca açık `AUTH_PUBLIC_HOST` uygulanır — `.env`’de kalan ngrok `HOSTNAME` localhost’u bozmaz.
 *
 * İsteğe bağlı: `PUBLIC_URL_PROTOCOL=http|https`
 */

function looksLikeOAuthPublicHost(raw: string): boolean {
  const h = raw.replace(/^https?:\/\//, "").split("/")[0].split(":")[0] ?? "";
  if (!h) return false;
  if (h === "localhost" || h.startsWith("127.") || h === "[::1]") return true;
  // Docker kısa konteyner adı vb.
  if (/^[a-f0-9]{12}$/i.test(h)) return false;
  // dış domain / LAN .local / ngrok
  return h.includes(".");
}

function resolveRawHost(): string | undefined {
  const explicit =
    process.env.AUTH_PUBLIC_HOST?.trim() ||
    process.env.PUBLIC_HOSTNAME?.trim() ||
    process.env.AUTH_HOSTNAME?.trim();
  if (explicit) return explicit;

  // Yerelde .env’de kalan ngrok HOSTNAME, AUTH_URL’i dış domaine çevirip localhost testlerini bozar.
  // Production’da (Docker/VM) aynı satır tek başına OAuth kökü olarak kullanılır.
  if (process.env.NODE_ENV === "development") return undefined;

  const sys = process.env.HOSTNAME?.trim();
  if (sys && looksLikeOAuthPublicHost(sys)) return sys;
  return undefined;
}

export function getPublicAuthOrigin(): string | undefined {
  const raw = resolveRawHost();
  if (!raw) return undefined;

  let host = raw.replace(/^https?:\/\//, "").replace(/\/$/, "");
  if (!host) return undefined;

  const explicitProto = process.env.PUBLIC_URL_PROTOCOL?.trim().toLowerCase();
  const proto =
    explicitProto === "http" || explicitProto === "https"
      ? explicitProto
      : host.startsWith("localhost") ||
          host.startsWith("127.0.0.1") ||
          host.startsWith("[::1]")
        ? "http"
        : "https";

  return `${proto}://${host}`;
}

let applied = false;

/** Sunucu girişinde bir kez; çözülen origin → AUTH_URL / NEXTAUTH_URL */
export function applyAuthPublicUrlFromEnv(): void {
  if (applied) return;
  applied = true;
  const origin = getPublicAuthOrigin();
  if (!origin) return;
  process.env.AUTH_URL = origin;
  process.env.NEXTAUTH_URL = origin;
}

applyAuthPublicUrlFromEnv();
