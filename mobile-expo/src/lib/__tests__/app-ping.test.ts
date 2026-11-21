/**
 * /ping 401 donmez; on plana donuste suresi dolmus token'la gelen kullanici
 * baglanmadan gunun isareti yaziliyordu.
 */
import { beforeEach, describe, expect, it, jest } from "@jest/globals";
import type { Mock } from "jest-mock";

// jest.mock cagrilari bu importlarin ustune tasinir.
import { pingAppOpen } from "../app-ping";
import { api, refreshSession } from "../api";

jest.mock("expo-secure-store", () => {
  const store = new Map<string, string>();
  return {
    __store: store,
    getItemAsync: jest.fn(async (k: string) => store.get(k) ?? null),
    setItemAsync: jest.fn(async (k: string, v: string) => void store.set(k, v)),
    deleteItemAsync: jest.fn(async (k: string) => void store.delete(k)),
  };
});
jest.mock("expo-updates", () => ({ runtimeVersion: "1.0.0" }));
jest.mock("expo-constants", () => ({ __esModule: true, default: { expoConfig: { version: "1.0.0" } } }));
jest.mock("../api", () => ({ api: jest.fn(), refreshSession: jest.fn() }));

const store = jest.requireMock<{ __store: Map<string, string> }>("expo-secure-store").__store;
const apiMock = api as unknown as Mock<(path: string) => Promise<unknown>>;
const refreshMock = refreshSession as unknown as Mock<() => Promise<string>>;

beforeEach(() => {
  store.clear();
  apiMock.mockReset();
  refreshMock.mockReset();
});

describe("pingAppOpen", () => {
  it("kullanici baglanmadiysa token'i yeniler ve bir kez daha dener", async () => {
    apiMock.mockResolvedValueOnce({ ok: true, linked: false }).mockResolvedValueOnce({ ok: true, linked: true });
    refreshMock.mockResolvedValue("ok");
    await pingAppOpen("u1");
    expect(refreshMock).toHaveBeenCalledTimes(1);
    expect(apiMock).toHaveBeenCalledTimes(2);
    expect(store.get("bp.lastPing")).toMatch(/\|u1$/);
  });

  it("yenileme basarisizsa gunun isareti yazilmaz, sonraki acilis dener", async () => {
    apiMock.mockResolvedValue({ ok: true, linked: false });
    refreshMock.mockResolvedValue("network");
    await pingAppOpen("u1");
    expect(store.has("bp.lastPing")).toBe(false);
  });

  it("girissiz ping yenileme denemez", async () => {
    apiMock.mockResolvedValue({ ok: true, linked: false });
    await pingAppOpen(null);
    expect(refreshMock).not.toHaveBeenCalled();
    expect(store.has("bp.lastPing")).toBe(true);
  });
});
