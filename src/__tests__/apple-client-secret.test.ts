import { generateKeyPairSync, verify } from "node:crypto";
import { describe, expect, it } from "vitest";
import { buildAppleClientSecret } from "@/lib/auth-providers";

const { privateKey, publicKey } = generateKeyPairSync("ec", { namedCurve: "P-256" });
const pem = privateKey.export({ type: "pkcs8", format: "pem" }).toString();
const env = {
  APPLE_ID: "com.example.web",
  APPLE_KEY_ID: "KEY1234567",
  APPLE_TEAM_ID: "TEAM123456",
  APPLE_PRIVATE_KEY_B64: Buffer.from(pem).toString("base64"),
} as unknown as NodeJS.ProcessEnv;

describe("buildAppleClientSecret", () => {
  it("Apple'in bekledigi ES256 JWT'yi uretir ve imza dogrulanir", () => {
    const jwt = buildAppleClientSecret(env, 1_000_000)!;
    const [h, p, s] = jwt.split(".");
    expect(JSON.parse(Buffer.from(h, "base64url").toString())).toEqual({ alg: "ES256", kid: "KEY1234567" });
    const claims = JSON.parse(Buffer.from(p, "base64url").toString());
    expect(claims).toMatchObject({ iss: "TEAM123456", sub: "com.example.web", aud: "https://appleid.apple.com", iat: 1_000_000 });
    expect(claims.exp - claims.iat).toBeLessThanOrEqual(15_777_000); // Apple: en fazla 6 ay
    const ok = verify("sha256", Buffer.from(`${h}.${p}`), { key: publicKey, dsaEncoding: "ieee-p1363" }, Buffer.from(s, "base64url"));
    expect(ok).toBe(true);
  });

  it("eksik ya da bozuk anahtarda null doner, firlatmaz", () => {
    expect(buildAppleClientSecret({ ...env, APPLE_KEY_ID: "" } as NodeJS.ProcessEnv)).toBeNull();
    expect(buildAppleClientSecret({ ...env, APPLE_PRIVATE_KEY_B64: "Ym96dWs=" } as NodeJS.ProcessEnv)).toBeNull();
  });
});
