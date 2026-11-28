import { describe, it, expect } from "vitest";
import { checkRedisMemory, evaluateRedisMemory, parseRedisInfo } from "@/lib/redis-health";

/** Redis bellegi dolup oturum ve hiz siniri kayitlarini bosaltmadan once gorunur olmali (2026-11-28). */
const MB = 1024 * 1024;
const info = (over: Record<string, string> = {}) =>
  parseRedisInfo(
    [
      "# Memory",
      `used_memory:${over.used_memory ?? 20 * MB}`,
      `maxmemory:${over.maxmemory ?? 192 * MB}`,
      `maxmemory_policy:${over.maxmemory_policy ?? "volatile-ttl"}`,
      "",
      "# Stats",
      `evicted_keys:${over.evicted_keys ?? 0}`,
      "",
      "# Keyspace",
      over.keyspace ?? "db0:keys=1000,expires=1000,avg_ttl=86400000",
    ].join("\r\n"),
  );

describe("redis-health", () => {
  it("INFO ciktisini alan:deger olarak ayristirir, basliklari atlar", () => {
    const parsed = parseRedisInfo("# Memory\r\nused_memory:42\r\nmaxmemory_policy:volatile-ttl\r\n");
    expect(parsed).toEqual({ used_memory: "42", maxmemory_policy: "volatile-ttl" });
  });

  it("saglikli Redis ok doner ve sayilari tasir", () => {
    const r = evaluateRedisMemory(info());
    expect(r.status).toBe("ok");
    expect(r.reasons).toEqual([]);
    expect(r.keys).toBe(1000);
    expect(r.keysWithoutTtl).toBe(0);
    expect(r.usageRatio).toBeCloseTo(20 / 192, 2);
  });

  it("bosaltilan anahtar varsa broken", () => {
    const r = evaluateRedisMemory(info({ evicted_keys: "3" }));
    expect(r.status).toBe("broken");
    expect(r.reasons).toContain("keys_evicted");
  });

  it("bellek %90'a ulasinca broken, %75'te warning", () => {
    expect(evaluateRedisMemory(info({ used_memory: String(173 * MB) })).status).toBe("broken");
    expect(evaluateRedisMemory(info({ used_memory: String(150 * MB) })).status).toBe("warning");
  });

  it("beklenmeyen politika, sinirsiz bellek ve suresiz anahtar warning", () => {
    expect(evaluateRedisMemory(info({ maxmemory_policy: "allkeys-lru" })).reasons).toContain("unexpected_policy");
    const unlimited = evaluateRedisMemory(info({ maxmemory: "0" }));
    expect(unlimited.status).toBe("warning");
    expect(unlimited.reasons).toContain("no_maxmemory");
    const noTtl = evaluateRedisMemory(info({ keyspace: "db0:keys=10,expires=7,avg_ttl=1" }));
    expect(noTtl.status).toBe("warning");
    expect(noTtl.keysWithoutTtl).toBe(3);
  });

  it("broken, warning'e dusurulmez", () => {
    const r = evaluateRedisMemory(info({ evicted_keys: "1", maxmemory_policy: "allkeys-lru" }));
    expect(r.status).toBe("broken");
    expect(r.reasons).toEqual(["keys_evicted", "unexpected_policy"]);
  });

  it("eksik INFO unknown", () => {
    expect(evaluateRedisMemory({}).status).toBe("unknown");
  });

  it("Redis yoksa not_configured, INFO hata verirse unknown", async () => {
    expect((await checkRedisMemory(null)).status).toBe("not_configured");
    const failing = { info: async () => Promise.reject(new Error("down")) } as unknown as Parameters<typeof checkRedisMemory>[0];
    expect(await checkRedisMemory(failing)).toEqual({ status: "unknown", reasons: ["info_failed"] });
  });
});
