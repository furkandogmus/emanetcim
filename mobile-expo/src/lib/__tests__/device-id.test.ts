import { describe, expect, it, jest } from "@jest/globals";

jest.mock("expo-secure-store", () => {
  const store = new Map<string, string>();
  return {
    getItemAsync: jest.fn(async (k: string) => store.get(k) ?? null),
    setItemAsync: jest.fn(async (k: string, v: string) => void store.set(k, v)),
  };
});

import { getDeviceId, isUuidV4, randomUuidV4 } from "../device-id";

describe("device id", () => {
  it("uretilen kimlik RFC 4122 v4 (sunucu zod uuid kabul eder)", () => {
    for (let i = 0; i < 50; i++) expect(isUuidV4(randomUuidV4())).toBe(true);
    expect(isUuidV4(randomUuidV4(() => 0))).toBe(true);
    expect(isUuidV4(randomUuidV4(() => 0.9999))).toBe(true);
  });

  it("ayni cihazda sabit kalir", async () => {
    const a = await getDeviceId();
    expect(await getDeviceId()).toBe(a);
  });
});
