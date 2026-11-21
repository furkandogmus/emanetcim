import { describe, it, expect } from "vitest";
import { claimRefreshJti, rememberIssuedPair, releaseRefreshJti, REFRESH_GRACE_MS } from "@/lib/refresh-token-store";

const pair = { accessToken: "a", refreshToken: "r" };

describe("claimRefreshJti — refresh token tekrar kullanım tespiti", () => {
  it("bir jti'yi ilk kez ister: first", async () => {
    expect(await claimRefreshJti(crypto.randomUUID(), 60_000)).toEqual({ kind: "first" });
  });

  it("pencere içinde tekrar: saklanan çift döner (idempotent)", async () => {
    const jti = crypto.randomUUID();
    const t0 = Date.now();
    expect((await claimRefreshJti(jti, 3_600_000, t0)).kind).toBe("first");
    await rememberIssuedPair(jti, pair, crypto.randomUUID(), t0);
    expect(await claimRefreshJti(jti, 3_600_000, t0 + 5_000)).toEqual({ kind: "repeat", pair });
  });

  it("pencere içinde ama çift henüz yazılmadıysa: pending", async () => {
    const jti = crypto.randomUUID();
    const t0 = Date.now();
    await claimRefreshJti(jti, 3_600_000, t0);
    expect((await claimRefreshJti(jti, 3_600_000, t0 + 1_000)).kind).toBe("pending");
  });

  it("pencere dışında tekrar: reused (replay)", async () => {
    const jti = crypto.randomUUID();
    const t0 = Date.now();
    await claimRefreshJti(jti, 3_600_000, t0);
    await rememberIssuedPair(jti, pair, crypto.randomUUID(), t0);
    expect((await claimRefreshJti(jti, 3_600_000, t0 + REFRESH_GRACE_MS + 1)).kind).toBe("reused");
  });

  it("pencere içinde tekrar ama halef zaten kullanıldı: reused (çalınmış token replay'i)", async () => {
    const a = crypto.randomUUID();
    const b = crypto.randomUUID();
    const t0 = Date.now();
    expect((await claimRefreshJti(a, 3_600_000, t0)).kind).toBe("first");
    await rememberIssuedPair(a, pair, b, t0);
    expect((await claimRefreshJti(b, 3_600_000, t0 + 1_000)).kind).toBe("first");
    expect((await claimRefreshJti(a, 3_600_000, t0 + 2_000)).kind).toBe("reused");
  });

  it("isaret geri alınınca aynı jti yine ilk kullanım sayılır", async () => {
    const jti = crypto.randomUUID();
    const t0 = Date.now();
    await claimRefreshJti(jti, 3_600_000, t0);
    await releaseRefreshJti(jti);
    expect((await claimRefreshJti(jti, 3_600_000, t0 + 1_000)).kind).toBe("first");
  });

  it("farklı jti'ler birbirini etkilemez", async () => {
    const a = crypto.randomUUID();
    const b = crypto.randomUUID();
    const t0 = Date.now();
    expect((await claimRefreshJti(a, 3_600_000, t0)).kind).toBe("first");
    expect((await claimRefreshJti(b, 3_600_000, t0)).kind).toBe("first");
    expect((await claimRefreshJti(a, 3_600_000, t0 + REFRESH_GRACE_MS + 1)).kind).toBe("reused");
  });

  it("ttl <= 0 ise (süresi zaten geçmiş token) engellemez — exp kontrolü zaten önce çalışır", async () => {
    const jti = crypto.randomUUID();
    expect((await claimRefreshJti(jti, 0)).kind).toBe("first");
    expect((await claimRefreshJti(jti, -100)).kind).toBe("first");
  });
});
