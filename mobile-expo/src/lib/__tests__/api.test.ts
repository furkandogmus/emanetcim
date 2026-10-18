/**
 * Sunucu refresh token'i tek kullanimlik sayar; ikinci kullanim butun oturum
 * ailesini iptal eder. Bu yuzden yenileme TEK UCUSTA kalmak zorunda.
 */
import { beforeEach, describe, expect, it, jest } from "@jest/globals";
import type { Mock } from "jest-mock";

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

/** `api.ts` modul duzeyinde token tutar; her test taze modulle baslar. */
function freshApi(): ApiModule {
  let mod!: ApiModule;
  jest.isolateModules(() => {
    mod = jest.requireActual<ApiModule>("../api");
  });
  return mod;
}

const fetchMock: Mock<(url: string, init?: RequestInit) => Promise<unknown>> = jest.fn();

beforeEach(() => {
  fetchMock.mockReset();
  global.fetch = fetchMock as unknown as typeof fetch;
});

describe("api token yenileme", () => {
  it("eszamanli iki 401 tek refresh istegi gonderir, ikisi de yeni token ile tekrar dener", async () => {
    const { api, saveTokens } = freshApi();
    await saveTokens("eski-access", "refresh-1");

    fetchMock.mockImplementation(async (url: string, init?: RequestInit) => {
      if (url.endsWith("/auth/refresh")) {
        await new Promise((r) => setTimeout(r, 10));
        return json(200, { accessToken: "yeni-access", refreshToken: "refresh-2" });
      }
      const auth = (init?.headers as Record<string, string>).Authorization;
      return auth === "Bearer yeni-access" ? json(200, { ok: url }) : json(401, { error: "unauthorized" });
    });

    const [a, b] = await Promise.all([api<{ ok: string }>("/a"), api<{ ok: string }>("/b")]);

    expect(a.ok).toMatch(/\/a$/);
    expect(b.ok).toMatch(/\/b$/);
    const refreshCalls = fetchMock.mock.calls.filter(([u]) => String(u).endsWith("/auth/refresh"));
    expect(refreshCalls).toHaveLength(1);
  });

  it("refresh reddedilirse token'lari siler, oturum isleyicisini bir kez cagirir, session_expired atar", async () => {
    const SecureStore = jest.requireMock<typeof import("expo-secure-store")>("expo-secure-store");
    const { api, saveTokens, setSessionExpiredHandler } = freshApi();
    await saveTokens("eski-access", "refresh-1");
    const expired = jest.fn();
    setSessionExpiredHandler(expired);

    fetchMock.mockImplementation(async (url: string) =>
      url.endsWith("/auth/refresh") ? json(401, { error: "invalid_refresh" }) : json(401, { error: "unauthorized" }),
    );

    await expect(api("/me")).rejects.toMatchObject({ status: 401, code: "session_expired" });
    expect(expired).toHaveBeenCalledTimes(1);
    expect(SecureStore.deleteItemAsync).toHaveBeenCalledWith("bp.accessToken");
    expect(SecureStore.deleteItemAsync).toHaveBeenCalledWith("bp.refreshToken");
  });

  it("ag hatasi network koduna doner", async () => {
    const { api } = freshApi();
    fetchMock.mockRejectedValue(new TypeError("Network request failed") as never);
    await expect(api("/shops", { auth: false })).rejects.toMatchObject({ status: 0, code: "network" });
  });

  it("sunucu hata govdesindeki kodu tasir, govde yoksa http_<status>", async () => {
    const { api } = freshApi();
    fetchMock.mockResolvedValueOnce(json(409, { error: "insufficient_capacity" }));
    await expect(api("/checkout/intent", { method: "POST", body: {}, auth: false })).rejects.toMatchObject({
      status: 409,
      code: "insufficient_capacity",
    });
    fetchMock.mockResolvedValueOnce({ ok: false, status: 502, text: async () => "<html>" });
    await expect(api("/x", { auth: false })).rejects.toMatchObject({ code: "http_502" });
  });
});
