import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * Redis sayaci sureyle birlikte, TEK islemde yazilir (2026-11-28).
 *
 * Onceki `INCR` + ayri `PEXPIRE` arasinda kopan baglanti suresiz bir anahtar
 * birakiyordu; `volatile-ttl` politikasi suresiz anahtari hic bosaltmaz.
 */
const { calls, execResult } = vi.hoisted(() => ({
  calls: [] as unknown[][],
  execResult: { value: [[null, 1], [null, 1]] as [Error | null, unknown][] | null },
}));

vi.mock("ioredis", () => {
  class FakeRedis {
    on() {
      return this;
    }
    multi() {
      const chain = {
        incr: (key: string) => {
          calls.push(["incr", key]);
          return chain;
        },
        pexpire: (...args: unknown[]) => {
          calls.push(["pexpire", ...args]);
          return chain;
        },
        exec: async () => execResult.value,
      };
      return chain;
    }
  }
  return { default: FakeRedis };
});

beforeEach(() => {
  calls.length = 0;
  vi.resetModules();
  process.env.REDIS_URL = "redis://127.0.0.1:6379";
});

describe("rateLimit (Redis)", () => {
  it("INCR ve PEXPIRE NX ayni MULTI icinde gider", async () => {
    execResult.value = [[null, 1], [null, 1]];
    const { rateLimit } = await import("@/lib/rate-limit");
    expect(await rateLimit("login:ip:203.0.113.7", 5, 60_000)).toBe(true);
    expect(calls).toHaveLength(2);
    expect(calls[0]?.[0]).toBe("incr");
    expect(calls[1]).toEqual(["pexpire", calls[0]?.[1], 60_000, "NX"]);
  });

  it("sinir asilinca false doner", async () => {
    execResult.value = [[null, 6], [null, 0]];
    const { rateLimit } = await import("@/lib/rate-limit");
    expect(await rateLimit("login:ip:203.0.113.7", 5, 60_000)).toBe(false);
  });

  it("Redis hatasi yutulmaz (onceki davranisla ayni: cagirana firlar)", async () => {
    execResult.value = [[new Error("OOM command not allowed"), null], [null, 0]];
    const { rateLimit } = await import("@/lib/rate-limit");
    await expect(rateLimit("login:ip:203.0.113.7", 5, 60_000)).rejects.toThrow("OOM");
  });

  it("iptal edilen islem de hata sayilir", async () => {
    execResult.value = null;
    const { rateLimit } = await import("@/lib/rate-limit");
    await expect(rateLimit("login:ip:203.0.113.7", 5, 60_000)).rejects.toThrow("rate_limit_multi_aborted");
  });
});
