/**
 * Apple Wallet / Google Wallet yapilandirmasi. Tek kaynak ortam degiskenleri
 * (uretimde SSM -> docker-compose.env); sertifika ve anahtar depoya girmez.
 *
 * Bir taraf ancak TUM zorunlu degiskenleri doluysa "yapilandirilmis" sayilir;
 * eksik tek bir deger o tarafi tamamen kapatir (dugme gizli, uclar 404, push yok).
 */

export type AppleWalletConfig = {
  passTypeId: string;
  teamId: string;
  signerCert: string;
  signerKey: string;
  signerKeyPassphrase?: string;
  wwdr: string;
};

export type GoogleWalletConfig = {
  issuerId: string;
  serviceAccountEmail: string;
  privateKey: string;
};

/** Zorunlu Apple anahtarlari (passphrase istege bagli: sifresiz anahtar da olur). */
export const APPLE_WALLET_ENV = [
  "WALLET_APPLE_PASS_TYPE_ID",
  "APPLE_TEAM_ID",
  "WALLET_APPLE_SIGNER_CERT_B64",
  "WALLET_APPLE_SIGNER_KEY_B64",
  "WALLET_APPLE_WWDR_CERT_B64",
] as const;

export const GOOGLE_WALLET_ENV = [
  "WALLET_GOOGLE_ISSUER_ID",
  "WALLET_GOOGLE_SA_EMAIL",
  "WALLET_GOOGLE_SA_KEY_B64",
] as const;

/** Env dosyasi cok satir tasimaz: PEM base64 gelir. Duz PEM de kabul edilir (yerel deneme). */
export function decodePem(raw: string | undefined): string | null {
  const v = raw?.trim();
  if (!v) return null;
  if (v.startsWith("-----BEGIN")) return v.replace(/\\n/g, "\n");
  const decoded = Buffer.from(v, "base64").toString("utf8").trim();
  return decoded.startsWith("-----BEGIN") ? decoded : null;
}

function str(env: NodeJS.ProcessEnv, key: string): string | null {
  const v = env[key]?.trim();
  return v ? v : null;
}

export function readAppleWalletConfig(env: NodeJS.ProcessEnv = process.env): AppleWalletConfig | null {
  const passTypeId = str(env, "WALLET_APPLE_PASS_TYPE_ID");
  const teamId = str(env, "APPLE_TEAM_ID");
  const signerCert = decodePem(env.WALLET_APPLE_SIGNER_CERT_B64);
  const signerKey = decodePem(env.WALLET_APPLE_SIGNER_KEY_B64);
  const wwdr = decodePem(env.WALLET_APPLE_WWDR_CERT_B64);
  if (!passTypeId || !teamId || !signerCert || !signerKey || !wwdr) return null;
  const signerKeyPassphrase = str(env, "WALLET_APPLE_SIGNER_KEY_PASSPHRASE") ?? undefined;
  return { passTypeId, teamId, signerCert, signerKey, wwdr, ...(signerKeyPassphrase ? { signerKeyPassphrase } : {}) };
}

export function readGoogleWalletConfig(env: NodeJS.ProcessEnv = process.env): GoogleWalletConfig | null {
  const issuerId = str(env, "WALLET_GOOGLE_ISSUER_ID");
  const serviceAccountEmail = str(env, "WALLET_GOOGLE_SA_EMAIL");
  const privateKey = decodePem(env.WALLET_GOOGLE_SA_KEY_B64);
  if (!issuerId || !serviceAccountEmail || !privateKey) return null;
  return { issuerId, serviceAccountEmail, privateKey };
}

export type WalletCapabilities = { walletApple: boolean; walletGoogle: boolean };

export function walletCapabilities(env: NodeJS.ProcessEnv = process.env): WalletCapabilities {
  return {
    walletApple: readAppleWalletConfig(env) !== null,
    walletGoogle: readGoogleWalletConfig(env) !== null,
  };
}
