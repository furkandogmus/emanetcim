import { describe, it, expect } from "vitest";
import { claimRefreshJti } from "@/lib/refresh-token-store";

describe("claimRefreshJti — refresh token tekrar kullanım tespiti", () => {
  it("bir jti'yi ilk kez ister true döner (ilk kullanım)", async () => {
    const jti = crypto.randomUUID();
    expect(await claimRefreshJti(jti, 60_000)).toBe(true);
  });

  it("aynı jti ikinci kez istenirse false döner (replay)", async () => {
    const jti = crypto.randomUUID();
    expect(await claimRefreshJti(jti, 60_000)).toBe(true);
    expect(await claimRefreshJti(jti, 60_000)).toBe(false);
  });

  it("farklı jti'ler birbirini etkilemez", async () => {
    const a = crypto.randomUUID();
    const b = crypto.randomUUID();
    expect(await claimRefreshJti(a, 60_000)).toBe(true);
    expect(await claimRefreshJti(b, 60_000)).toBe(true);
    expect(await claimRefreshJti(a, 60_000)).toBe(false);
  });

  it("ttl <= 0 ise (süresi zaten geçmiş token) engellemez — exp kontrolü zaten önce çalışır", async () => {
    const jti = crypto.randomUUID();
    expect(await claimRefreshJti(jti, 0)).toBe(true);
    expect(await claimRefreshJti(jti, -100)).toBe(true);
  });
});
