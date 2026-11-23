import { createPrivateKey, sign } from "node:crypto";

/*
  Apple web girisinin istemci sirri, Apple'in .p8 anahtariyla imzalanmis bir ES256 JWT'dir
  ve en fazla 6 ay gecerlidir. Elle uretilip APPLE_SECRET'a yazilirsa 6 ayda bir sessizce
  biter; bu yuzden anahtardan (APPLE_PRIVATE_KEY_B64 + APPLE_KEY_ID + APPLE_TEAM_ID)
  surec basinda uretilir. APPLE_SECRET doluysa o kullanilir (eski kurulum).
*/
const APPLE_SECRET_TTL_S = 180 * 24 * 60 * 60;

const b64url = (buf: Buffer) => buf.toString("base64url");

export function buildAppleClientSecret(
  env: NodeJS.ProcessEnv = process.env,
  nowS: number = Math.floor(Date.now() / 1000),
): string | null {
  const clientId = env.APPLE_ID?.trim();
  const keyId = env.APPLE_KEY_ID?.trim();
  const teamId = env.APPLE_TEAM_ID?.trim();
  const keyB64 = env.APPLE_PRIVATE_KEY_B64?.trim();
  if (!clientId || !keyId || !teamId || !keyB64) return null;
  try {
    const key = createPrivateKey(Buffer.from(keyB64, "base64").toString("utf8"));
    const header = b64url(Buffer.from(JSON.stringify({ alg: "ES256", kid: keyId })));
    const payload = b64url(
      Buffer.from(
        JSON.stringify({
          iss: teamId,
          iat: nowS,
          exp: nowS + APPLE_SECRET_TTL_S,
          aud: "https://appleid.apple.com",
          sub: clientId,
        }),
      ),
    );
    const sig = sign("sha256", Buffer.from(`${header}.${payload}`), { key, dsaEncoding: "ieee-p1363" });
    return `${header}.${payload}.${b64url(sig)}`;
  } catch {
    // Bozuk anahtar girisi kapatir, sunucuyu dusurmez.
    return null;
  }
}

let cachedSecret: { value: string | null; atS: number } | null = null;

/** Surec icinde onbellekli; 30 gunde bir yeniden imzalanir (TTL 180 gun). */
export function appleClientSecret(): string | null {
  const explicit = process.env.APPLE_SECRET?.trim();
  if (explicit) return explicit;
  const nowS = Math.floor(Date.now() / 1000);
  if (!cachedSecret || nowS - cachedSecret.atS > 30 * 24 * 60 * 60) {
    cachedSecret = { value: buildAppleClientSecret(process.env, nowS), atS: nowS };
  }
  return cachedSecret.value;
}

/**
 * OAuth sağlayıcıları sunucuda kayıtlı mı — UI ile auth.config aynı koşulu kullanır.
 */
export function isAppleOAuthConfigured(): boolean {
  return !!(process.env.APPLE_ID?.trim() && appleClientSecret());
}

/** Yerel geliştirme veya açıkça açılmış staging: hızlı demo girişleri. */
export function isAuthDemoUiEnabled(): boolean {
  if (process.env.NODE_ENV !== "production") return true;
  return process.env.NEXT_PUBLIC_ENABLE_AUTH_DEMO?.trim() === "true";
}
