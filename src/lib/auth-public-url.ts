/**
 * OAuth (Auth.js) için kamu kök URL (`AUTH_URL` / `NEXTAUTH_URL`).
 *
 * Tek kaynak: `AUTH_PUBLIC_HOST` — `host`, `host:port` veya `https://host` biçimi.
 * Boşsa burada bir şey yazılmaz; mevcut ortam değişkenleri olduğu gibi kalır.
 *
 * İsteğe bağlı: `PUBLIC_URL_PROTOCOL=http|https` — aksi halde localhost için http,
 * diğer hostlar için https varsayılır.
 */

function stripHost(raw: string): string {
  return raw.replace(/^https?:\/\//, "").replace(/\/$/, "");
}

export function getPublicAuthOrigin(): string | undefined {
  const raw = process.env.AUTH_PUBLIC_HOST?.trim();
  if (!raw) return undefined;

  const host = stripHost(raw);
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
