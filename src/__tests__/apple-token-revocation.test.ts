import { generateKeyPairSync, randomBytes } from "node:crypto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/** Sign in with Apple: kod -> refresh token (sifreli) ve hesap silmede iptal (5.1.1(v)). */

const m = vi.hoisted(() => ({
  prisma: { account: { updateMany: vi.fn(), findMany: vi.fn() } },
  fetch: vi.fn(),
}));

vi.mock("@/lib/db", () => ({ default: m.prisma }));
vi.mock("@/lib/logger", () => ({ default: { warn: vi.fn(), error: vi.fn(), info: vi.fn() } }));
vi.mock("@/lib/async-timeout", () => ({ fetchWithTimeout: m.fetch }));

import { loadSealKey, sealSecret, unsealSecret } from "@/lib/sealed-secret";
import { appleTokenService } from "@/services/AppleTokenService";

const pem = generateKeyPairSync("ec", { namedCurve: "P-256" })
  .privateKey.export({ type: "pkcs8", format: "pem" })
  .toString();
const KEY_B64 = randomBytes(32).toString("base64");

function bodyOf(call: unknown[]): URLSearchParams {
  return new URLSearchParams((call[1] as RequestInit).body as string);
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv("APPLE_ID", "com.example.web");
  vi.stubEnv("APPLE_SECRET", "");
  vi.stubEnv("APPLE_KEY_ID", "KEY1234567");
  vi.stubEnv("APPLE_TEAM_ID", "TEAM123456");
  vi.stubEnv("APPLE_PRIVATE_KEY_B64", Buffer.from(pem).toString("base64"));
  vi.stubEnv("APPLE_TOKEN_ENCRYPTION_KEY", KEY_B64);
});

afterEach(() => vi.unstubAllEnvs());

describe("sealed-secret", () => {
  it("sifreler, ayni anahtarla acar; yanlis anahtar ya da kurcalama null", () => {
    const key = loadSealKey(KEY_B64)!;
    const sealed = sealSecret("rt-123", key);
    expect(sealed).not.toContain("rt-123");
    expect(unsealSecret(sealed, key)).toBe("rt-123");
    expect(unsealSecret(sealed, randomBytes(32))).toBeNull();
    const parts = sealed.split(".");
    parts[3] = Buffer.from("x").toString("base64url");
    expect(unsealSecret(parts.join("."), key)).toBeNull();
  });

  it("32 bayt olmayan ya da bos anahtari reddeder", () => {
    expect(loadSealKey("")).toBeNull();
    expect(loadSealKey(Buffer.from("kisa").toString("base64"))).toBeNull();
  });
});

describe("AppleTokenService.exchangeAndStore", () => {
  it("kodu uygulama kimligiyle degistirir ve refresh token'i SIFRELI yazar", async () => {
    m.fetch.mockResolvedValue({ ok: true, status: 200, json: async () => ({ refresh_token: "rt-app" }) });
    const r = await appleTokenService.exchangeAndStore({
      providerAccountId: "sub-1",
      authorizationCode: "code-1",
      clientId: "com.example.app",
    });
    expect(r).toBe("stored");
    expect(m.fetch.mock.calls[0][0]).toBe("https://appleid.apple.com/auth/token");
    const body = bodyOf(m.fetch.mock.calls[0]);
    expect(body.get("client_id")).toBe("com.example.app");
    expect(body.get("code")).toBe("code-1");
    expect(body.get("grant_type")).toBe("authorization_code");
    const written = m.prisma.account.updateMany.mock.calls[0][0];
    expect(written.where).toEqual({ provider: "apple", providerAccountId: "sub-1" });
    expect(written.data.refresh_token).not.toContain("rt-app");
    expect(JSON.parse(unsealSecret(written.data.refresh_token, loadSealKey(KEY_B64)!)!)).toEqual({
      c: "com.example.app",
      r: "rt-app",
    });
  });

  it("anahtar yoksa Apple'a gitmez ve hicbir sey saklamaz", async () => {
    vi.stubEnv("APPLE_TOKEN_ENCRYPTION_KEY", "");
    const r = await appleTokenService.exchangeAndStore({
      providerAccountId: "sub-1",
      authorizationCode: "code-1",
      clientId: "com.example.app",
    });
    expect(r).toBe("no_key");
    expect(m.fetch).not.toHaveBeenCalled();
    expect(m.prisma.account.updateMany).not.toHaveBeenCalled();
  });

  it("Apple reddederse ya da ag duserse firlatmaz", async () => {
    m.fetch.mockResolvedValueOnce({ ok: false, status: 400, json: async () => ({ error: "invalid_grant" }) });
    await expect(
      appleTokenService.exchangeAndStore({ providerAccountId: "s", authorizationCode: "c", clientId: "com.example.app" }),
    ).resolves.toBe("exchange_failed");
    m.fetch.mockRejectedValueOnce(new Error("apple_token_exchange_timeout_after_8000ms"));
    await expect(
      appleTokenService.exchangeAndStore({ providerAccountId: "s", authorizationCode: "c", clientId: "com.example.app" }),
    ).resolves.toBe("exchange_failed");
    expect(m.prisma.account.updateMany).not.toHaveBeenCalled();
  });
});

describe("AppleTokenService.revokeForUser", () => {
  it("sifreli token'i saklandigi istemci kimligiyle, eski duz metin web token'ini web kimligiyle iptal eder", async () => {
    const sealed = sealSecret(JSON.stringify({ c: "com.example.app", r: "rt-app" }), loadSealKey(KEY_B64)!);
    m.prisma.account.findMany.mockResolvedValue([{ refresh_token: sealed }, { refresh_token: "legacy-web-rt" }, { refresh_token: null }]);
    m.fetch.mockResolvedValue({ ok: true, status: 200 });

    expect(await appleTokenService.revokeForUser("u1")).toBe(2);
    expect(m.prisma.account.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { userId: "u1", provider: "apple" } }),
    );
    const calls = m.fetch.mock.calls.map((c) => ({ url: c[0], body: bodyOf(c) }));
    expect(calls.every((c) => c.url === "https://appleid.apple.com/auth/revoke")).toBe(true);
    expect(calls.map((c) => [c.body.get("client_id"), c.body.get("token"), c.body.get("token_type_hint")])).toEqual([
      ["com.example.app", "rt-app", "refresh_token"],
      ["com.example.web", "legacy-web-rt", "refresh_token"],
    ]);
  });

  it("veritabani ya da Apple hatasinda 0 doner, silmeyi durdurmaz", async () => {
    m.prisma.account.findMany.mockRejectedValue(new Error("db down"));
    await expect(appleTokenService.revokeForUser("u1")).resolves.toBe(0);
  });
});
