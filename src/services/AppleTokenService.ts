import prisma from "@/lib/db";
import logger from "@/lib/logger";
import { fetchWithTimeout } from "@/lib/async-timeout";
import { appleClientSecretFor } from "@/lib/auth-providers";
import { isSealed, loadSealKey, sealSecret, unsealSecret } from "@/lib/sealed-secret";

/**
 * Sign in with Apple token iptali (App Store 5.1.1(v), 2026-11-23).
 *
 * Apple ile giris sunan uygulama, hesap silinince Apple'daki yetkiyi de
 * `auth/revoke` ile iptal etmek zorunda. Iptal bir refresh token (ya da access
 * token) ister; ikisini de ancak giristeki `authorizationCode`u `auth/token`
 * ile degistirerek aliriz. Bu yuzden:
 *   - girişte kod refresh token'a cevrilir ve SIFRELI saklanir (`Account.refresh_token`),
 *   - anonimlestirmede (`AccountPrivacyService.erase`) her Apple hesabi icin iptal edilir.
 *
 * Token, onu alan istemcinin kimligiyle (uygulama: `APPLE_BUNDLE_ID`, web:
 * `APPLE_ID`) iptal edilir; kimlik zarfin icinde tutulur.
 *
 * Hicbir yol FIRLATMAZ: Apple'a ulasilamamasi giris ya da silme akisini durdurmaz,
 * yalnizca log'a duser.
 */

const APPLE_TOKEN_URL = "https://appleid.apple.com/auth/token";
const APPLE_REVOKE_URL = "https://appleid.apple.com/auth/revoke";
const APPLE_TIMEOUT_MS = 8_000;

export type StoredToken = { c: string; r: string };

export type AppleStoreResult = "stored" | "no_key" | "no_secret" | "exchange_failed";

function form(body: Record<string, string>): RequestInit {
  return {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams(body).toString(),
  };
}

class AppleTokenService {
  /** Uygulamadan gelen tek kullanimlik kodu refresh token'a cevirip saklar. */
  async exchangeAndStore(params: {
    providerAccountId: string;
    authorizationCode: string;
    clientId: string;
  }): Promise<AppleStoreResult> {
    try {
      if (!loadSealKey()) {
        logger.warn({ provider: "apple" }, "apple_token_store_skipped_no_key");
        return "no_key";
      }
      const secret = appleClientSecretFor(params.clientId);
      if (!secret) {
        logger.warn({ provider: "apple" }, "apple_token_exchange_skipped_no_secret");
        return "no_secret";
      }
      const res = await fetchWithTimeout(
        APPLE_TOKEN_URL,
        form({
          grant_type: "authorization_code",
          code: params.authorizationCode,
          client_id: params.clientId,
          client_secret: secret,
        }),
        APPLE_TIMEOUT_MS,
        "apple_token_exchange",
      );
      const json = (await res.json().catch(() => null)) as { refresh_token?: unknown } | null;
      if (!res.ok || typeof json?.refresh_token !== "string") {
        logger.warn({ status: res.status }, "apple_token_exchange_failed");
        return "exchange_failed";
      }
      return await this.storeRefreshToken({
        providerAccountId: params.providerAccountId,
        clientId: params.clientId,
        refreshToken: json.refresh_token,
      });
    } catch (err) {
      logger.warn({ err }, "apple_token_exchange_failed");
      return "exchange_failed";
    }
  }

  /** Refresh token'i sifreleyip Apple hesabina yazar; anahtar yoksa hicbir sey yazmaz. */
  async storeRefreshToken(params: {
    providerAccountId: string;
    clientId: string;
    refreshToken: string;
  }): Promise<AppleStoreResult> {
    const key = loadSealKey();
    if (!key) {
      logger.warn({ provider: "apple" }, "apple_token_store_skipped_no_key");
      return "no_key";
    }
    const payload: StoredToken = { c: params.clientId, r: params.refreshToken };
    await prisma.account.updateMany({
      where: { provider: "apple", providerAccountId: params.providerAccountId },
      // Kimlik/erisim token'lari hic gerekmiyor; satirda duz metin kalmasinlar.
      data: { refresh_token: sealSecret(JSON.stringify(payload), key), access_token: null, id_token: null },
    });
    return "stored";
  }

  /**
   * Kullanicinin Apple yetkilerini iptal eder. Dondurulen sayi: iptal edilen token.
   * Silme bir islem icinde yapiliyorsa once `collectForUser` (satirlar silinmeden),
   * islem basariyla bitince `revokeTokens` cagrilir.
   */
  async revokeForUser(userId: string): Promise<number> {
    return this.revokeTokens(userId, await this.collectForUser(userId));
  }

  /** Iptal edilecek token'lari okur; hata durumunda bos liste (silme durmaz). */
  async collectForUser(userId: string): Promise<StoredToken[]> {
    try {
      const rows = await prisma.account.findMany({
        where: { userId, provider: "apple" },
        select: { refresh_token: true },
      });
      return rows.map((r) => this.readStored(r.refresh_token)).filter((t): t is StoredToken => t !== null);
    } catch (err) {
      logger.warn({ err, userId }, "apple_revoke_collect_failed");
      return [];
    }
  }

  async revokeTokens(userId: string, tokens: StoredToken[]): Promise<number> {
    let revoked = 0;
    for (const token of tokens) {
      if (await this.revoke(token)) revoked += 1;
    }
    if (revoked < tokens.length) logger.warn({ userId, tokens: tokens.length, revoked }, "apple_revoke_incomplete");
    return revoked;
  }

  /*
    Eski web satirlari: Auth.js adapter'i 2026-11-23'e kadar Apple refresh
    token'ini DUZ METIN yaziyordu (web istemcisi, `APPLE_ID`). Onlar da iptal
    edilir; yeni satirlar zarfli.
  */
  private readStored(value: string | null): StoredToken | null {
    if (!value) return null;
    if (!isSealed(value)) {
      const web = process.env.APPLE_ID?.trim();
      return web ? { c: web, r: value } : null;
    }
    const key = loadSealKey();
    if (!key) {
      logger.warn({ provider: "apple" }, "apple_revoke_skipped_no_key");
      return null;
    }
    const plain = unsealSecret(value, key);
    if (!plain) return null;
    try {
      const parsed = JSON.parse(plain) as Partial<StoredToken>;
      return typeof parsed.c === "string" && typeof parsed.r === "string" ? { c: parsed.c, r: parsed.r } : null;
    } catch {
      return null;
    }
  }

  private async revoke(token: StoredToken): Promise<boolean> {
    const secret = appleClientSecretFor(token.c);
    if (!secret) {
      logger.warn({ provider: "apple" }, "apple_revoke_skipped_no_secret");
      return false;
    }
    try {
      const res = await fetchWithTimeout(
        APPLE_REVOKE_URL,
        form({ client_id: token.c, client_secret: secret, token: token.r, token_type_hint: "refresh_token" }),
        APPLE_TIMEOUT_MS,
        "apple_revoke",
      );
      if (!res.ok) logger.warn({ status: res.status }, "apple_revoke_rejected");
      return res.ok;
    } catch (err) {
      logger.warn({ err }, "apple_revoke_failed");
      return false;
    }
  }
}

export const appleTokenService = new AppleTokenService();
