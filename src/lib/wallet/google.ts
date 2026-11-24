import { createPrivateKey } from "node:crypto";
import { SignJWT } from "jose";
import { fetchWithTimeout } from "@/lib/async-timeout";
import type { GoogleWalletConfig } from "@/lib/wallet/config";
import { googleClassId } from "@/lib/wallet/pass-content";

const TOKEN_URL = "https://oauth2.googleapis.com/token";
const WALLET_API = "https://walletobjects.googleapis.com/walletobjects/v1";
const SCOPE = "https://www.googleapis.com/auth/wallet_object.issuer";
const TIMEOUT_MS = 10_000;

/** Servis hesabi anahtari PKCS#8 gelir; elle uretilmis PKCS#1 da kabul edilir. */
function signingKey(cfg: GoogleWalletConfig) {
  return createPrivateKey(cfg.privateKey);
}

/** "Save to Google Wallet" bagi: sinif ve nesne JWT icinde, Google kaydederken olusturur. */
export async function googleSaveUrl(
  cfg: GoogleWalletConfig,
  genericObject: Record<string, unknown>,
  origin: string,
): Promise<string> {
  const key = signingKey(cfg);
  const jwt = await new SignJWT({
    typ: "savetowallet",
    origins: [origin],
    payload: {
      genericClasses: [{ id: googleClassId(cfg.issuerId) }],
      genericObjects: [genericObject],
    },
  })
    .setProtectedHeader({ alg: "RS256", typ: "JWT" })
    .setIssuer(cfg.serviceAccountEmail)
    .setAudience("google")
    .setIssuedAt()
    .sign(key);
  return `https://pay.google.com/gp/v/save/${jwt}`;
}

let cachedToken: { value: string; expiresAt: number; email: string } | null = null;

async function accessToken(cfg: GoogleWalletConfig): Promise<string> {
  if (cachedToken && cachedToken.email === cfg.serviceAccountEmail && cachedToken.expiresAt > Date.now() + 60_000) {
    return cachedToken.value;
  }
  const key = signingKey(cfg);
  const assertion = await new SignJWT({ scope: SCOPE })
    .setProtectedHeader({ alg: "RS256", typ: "JWT" })
    .setIssuer(cfg.serviceAccountEmail)
    .setAudience(TOKEN_URL)
    .setIssuedAt()
    .setExpirationTime("1h")
    .sign(key);
  const res = await fetchWithTimeout(
    TOKEN_URL,
    {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer", assertion }),
    },
    TIMEOUT_MS,
    "google_wallet_token",
  );
  if (!res.ok) throw new Error(`google_wallet_token_${res.status}`);
  const body = (await res.json()) as { access_token?: string; expires_in?: number };
  if (!body.access_token) throw new Error("google_wallet_token_missing");
  cachedToken = { value: body.access_token, expiresAt: Date.now() + (body.expires_in ?? 3600) * 1000, email: cfg.serviceAccountEmail };
  return body.access_token;
}

export function resetGoogleTokenCacheForTests() {
  cachedToken = null;
}

/**
 * Kaydedilmis nesneyi gunceller. 404 = misafir karti hic kaydetmemis; hata degil.
 * Donus: "updated" | "absent".
 */
export async function patchGoogleObject(
  cfg: GoogleWalletConfig,
  genericObject: { id: string } & Record<string, unknown>,
): Promise<"updated" | "absent"> {
  const token = await accessToken(cfg);
  const res = await fetchWithTimeout(
    `${WALLET_API}/genericObject/${encodeURIComponent(genericObject.id)}`,
    {
      method: "PATCH",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify(genericObject),
    },
    TIMEOUT_MS,
    "google_wallet_patch",
  );
  if (res.status === 404) return "absent";
  if (!res.ok) throw new Error(`google_wallet_patch_${res.status}`);
  return "updated";
}
