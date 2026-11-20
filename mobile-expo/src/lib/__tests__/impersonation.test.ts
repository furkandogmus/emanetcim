/**
 * Yonetici "kullanici olarak gir": token yalnizca bellekte, yenilenmez, 401 admin
 * oturumunu degil goruntulemeyi bitirir.
 */
import { beforeEach, describe, expect, it, jest } from "@jest/globals";
import type { Mock } from "jest-mock";

import { impersonationLabel, msUntilExpiry } from "../impersonation";

jest.mock("expo-secure-store", () => {
  const store = new Map<string, string>();
  return {
    getItemAsync: jest.fn(async (k: string) => store.get(k) ?? null),
    setItemAsync: jest.fn(async (k: string, v: string) => void store.set(k, v)),
    deleteItemAsync: jest.fn(async (k: string) => void store.delete(k)),
  };
});

type ApiModule = typeof import("../api");

function json(status: number, body: unknown) {
  return { ok: status >= 200 && status < 300, status, text: async () => JSON.stringify(body), json: async () => body };
}

function freshApi(): ApiModule {
  let mod!: ApiModule;
  jest.isolateModules(() => {
    mod = jest.requireActual<ApiModule>("../api");
  });
  return mod;
}

const fetchMock: Mock<(url: string, init?: RequestInit) => Promise<unknown>> = jest.fn();
const authOf = (i: number) => (fetchMock.mock.calls[i][1]?.headers as Record<string, string>).Authorization;

beforeEach(() => {
  fetchMock.mockReset();
  global.fetch = fetchMock as unknown as typeof fetch;
});

describe("msUntilExpiry", () => {
  it("kalan sureyi verir, gecmis ve bozuk tarih 0", () => {
    const now = Date.parse("2026-11-20T10:00:00Z");
    expect(msUntilExpiry("2026-11-20T10:30:00Z", now)).toBe(30 * 60 * 1000);
    expect(msUntilExpiry("2026-11-20T09:00:00Z", now)).toBe(0);
    expect(msUntilExpiry("bozuk", now)).toBe(0);
  });
});

describe("impersonationLabel", () => {
  it("ad, yoksa e-posta, yoksa telefon", () => {
    expect(impersonationLabel({ name: "Ayse", email: "a@example.test", phone: null })).toBe("Ayse");
    expect(impersonationLabel({ name: "  ", email: "a@example.test", phone: null })).toBe("a@example.test");
    expect(impersonationLabel({ name: null, email: null, phone: "5550000000" })).toBe("5550000000");
  });
});

describe("api goruntuleme token'i", () => {
  it("admin token'inin yerine gecer; birakilinca admin token'i geri gelir", async () => {
    const { api, saveTokens, setImpersonationToken } = freshApi();
    await saveTokens("admin-access", "admin-refresh");
    fetchMock.mockResolvedValue(json(200, {}));

    setImpersonationToken("imp-access");
    await api("/a");
    setImpersonationToken(null);
    await api("/b");

    expect(authOf(0)).toBe("Bearer imp-access");
    expect(authOf(1)).toBe("Bearer admin-access");
  });

  it("401'de yenilemez, admin token'larini silmez, yalnizca bitis isleyicisini cagirir", async () => {
    const SecureStore = jest.requireMock<typeof import("expo-secure-store")>("expo-secure-store");
    const { api, saveTokens, setImpersonationToken, setImpersonationEndedHandler, setSessionExpiredHandler } =
      freshApi();
    await saveTokens("admin-access", "admin-refresh");
    (SecureStore.deleteItemAsync as Mock).mockClear();
    const ended = jest.fn();
    const expired = jest.fn();
    setImpersonationEndedHandler(ended);
    setSessionExpiredHandler(expired);
    setImpersonationToken("imp-access");
    fetchMock.mockResolvedValue(json(401, { error: "unauthorized" }));

    await expect(api("/me")).rejects.toMatchObject({ status: 401, code: "impersonation_ended" });
    expect(ended).toHaveBeenCalledTimes(1);
    expect(expired).not.toHaveBeenCalled();
    expect(fetchMock.mock.calls.some(([u]) => String(u).endsWith("/auth/refresh"))).toBe(false);
    expect(SecureStore.deleteItemAsync).not.toHaveBeenCalled();
  });

  it("token SecureStore'a yazilmaz", async () => {
    const SecureStore = jest.requireMock<typeof import("expo-secure-store")>("expo-secure-store");
    (SecureStore.setItemAsync as Mock).mockClear();
    const { setImpersonationToken, isImpersonating } = freshApi();
    setImpersonationToken("imp-access");
    expect(isImpersonating()).toBe(true);
    expect(SecureStore.setItemAsync).not.toHaveBeenCalled();
  });
});
