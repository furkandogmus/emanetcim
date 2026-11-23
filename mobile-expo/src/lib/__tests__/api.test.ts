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

  it("iki token tek kayitta saklanir; eski ayri kayitlar okunup tasinir", async () => {
    const SecureStore = jest.requireMock<typeof import("expo-secure-store")>("expo-secure-store");
    await SecureStore.deleteItemAsync("bp.session");
    await SecureStore.setItemAsync("bp.accessToken", "eski-a");
    await SecureStore.setItemAsync("bp.refreshToken", "eski-r");
    const { loadTokens } = freshApi();
    expect(await loadTokens()).toEqual({ accessToken: "eski-a", refreshToken: "eski-r" });
    expect(JSON.parse((await SecureStore.getItemAsync("bp.session"))!)).toEqual({ accessToken: "eski-a", refreshToken: "eski-r" });
    const again = freshApi();
    expect(await again.loadTokens()).toEqual({ accessToken: "eski-a", refreshToken: "eski-r" });
  });

  it("yanit kaybolan refresh ayni token'la bir kez daha denenir (sunucu tolerans penceresi)", async () => {
    const { api, saveTokens } = freshApi();
    await saveTokens("eski-access", "refresh-1");
    let refreshCalls = 0;
    fetchMock.mockImplementation(async (url: string, init?: RequestInit) => {
      if (url.endsWith("/auth/refresh")) {
        refreshCalls += 1;
        expect(JSON.parse(String(init?.body)).refreshToken).toBe("refresh-1");
        if (refreshCalls === 1) throw new Error("aborted");
        return json(200, { accessToken: "yeni-access", refreshToken: "refresh-2" });
      }
      const auth = (init?.headers as Record<string, string>).Authorization;
      return auth === "Bearer yeni-access" ? json(200, { ok: true }) : json(401, { error: "unauthorized" });
    });
    await expect(api("/me")).resolves.toEqual({ ok: true });
    expect(refreshCalls).toBe(2);
  });

  it("refresh 503 ya da bozuk govde: oturum dusmez, network atar", async () => {
    const SecureStore = jest.requireMock<typeof import("expo-secure-store")>("expo-secure-store");
    const { api, saveTokens, setSessionExpiredHandler } = freshApi();
    await saveTokens("eski-access", "refresh-1");
    const expired = jest.fn();
    setSessionExpiredHandler(expired);
    fetchMock.mockImplementation(async (url: string) =>
      url.endsWith("/auth/refresh") ? json(503, { error: "service_unavailable" }) : json(401, { error: "unauthorized" }),
    );
    await expect(api("/me")).rejects.toMatchObject({ code: "network" });
    fetchMock.mockImplementation(async (url: string) =>
      url.endsWith("/auth/refresh")
        ? { ok: true, status: 200, text: async () => "{trunc", json: async () => JSON.parse("{trunc") }
        : json(401, { error: "unauthorized" }),
    );
    await expect(api("/me")).rejects.toMatchObject({ code: "network" });
    expect(expired).not.toHaveBeenCalled();
    expect(await SecureStore.getItemAsync("bp.session")).not.toBeNull();
  });

  it("eski ayri kayitlar her yazimda guncellenir (OTA geri alinirsa eski paket onlari okur)", async () => {
    const SecureStore = jest.requireMock<typeof import("expo-secure-store")>("expo-secure-store");
    const { saveTokens, clearTokens } = freshApi();
    await saveTokens("a-2", "r-2");
    expect(await SecureStore.getItemAsync("bp.accessToken")).toBe("a-2");
    expect(await SecureStore.getItemAsync("bp.refreshToken")).toBe("r-2");
    await clearTokens();
    expect(await SecureStore.getItemAsync("bp.accessToken")).toBeNull();
    expect(await SecureStore.getItemAsync("bp.refreshToken")).toBeNull();
    expect(await SecureStore.getItemAsync("bp.session")).toBeNull();
  });

  it("cikista yakalanan cift: suresi dolmus access token 401 alirsa bir kez yenilenir, push ve logout yeni token'la gider", async () => {
    const SecureStore = jest.requireMock<typeof import("expo-secure-store")>("expo-secure-store");
    const { api, saveTokens, clearTokens, detachSession, setSessionExpiredHandler } = freshApi();
    await saveTokens("suresi-dolmus", "refresh-1");
    const expired = jest.fn();
    setSessionExpiredHandler(expired);
    const session = detachSession()!;
    await clearTokens();
    fetchMock.mockImplementation(async (url: string, init?: RequestInit) => {
      if (url.endsWith("/auth/refresh")) {
        expect(JSON.parse(String(init?.body)).refreshToken).toBe("refresh-1");
        return json(200, { accessToken: "yenilenmis", refreshToken: "refresh-2" });
      }
      const auth = (init?.headers as Record<string, string>).Authorization;
      return auth === "Bearer yenilenmis" ? json(200, { ok: true }) : json(401, { error: "unauthorized" });
    });

    await expect(api("/push/register", { method: "DELETE", body: { token: "t" }, bearer: session })).resolves.toEqual({ ok: true });
    await expect(api("/auth/logout", { method: "POST", bearer: session })).resolves.toEqual({ ok: true });

    const urls = fetchMock.mock.calls.map(([u]) => String(u).replace(/^.*\/api\/mobile/, ""));
    expect(urls).toEqual(["/push/register", "/auth/refresh", "/push/register", "/auth/logout"]);
    const logout = fetchMock.mock.calls.find(([u]) => String(u).endsWith("/auth/logout"));
    expect((logout?.[1]?.headers as Record<string, string>).Authorization).toBe("Bearer yenilenmis");
    // Yeni cift diske ve modul durumuna yazilmaz: kullanici cikis yapti.
    expect(await SecureStore.getItemAsync("bp.session")).toBeNull();
    expect(expired).not.toHaveBeenCalled();
  });

  it("acik bearer: o token'la gider, 401'de yenileme ve oturum sonu calismaz", async () => {
    const { api, saveTokens, setSessionExpiredHandler } = freshApi();
    await saveTokens("guncel", "refresh-1");
    const expired = jest.fn();
    setSessionExpiredHandler(expired);
    fetchMock.mockResolvedValue(json(401, { error: "unauthorized" }) as never);
    await expect(api("/auth/logout", { method: "POST", bearer: "yakalanan" })).rejects.toMatchObject({ status: 401 });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect((fetchMock.mock.calls[0][1]?.headers as Record<string, string>).Authorization).toBe("Bearer yakalanan");
    expect(expired).not.toHaveBeenCalled();
  });
});

describe("api ek basliklar", () => {
  it("Idempotency-Key gibi ek baslik istege eklenir, Accept ezilmez", async () => {
    const { api } = freshApi();
    fetchMock.mockResolvedValue(json(200, { ok: true }));
    await api("/checkout/intent", {
      method: "POST",
      body: { a: 1 },
      auth: false,
      headers: { "Idempotency-Key": "k-12345678", Accept: "text/plain" },
    });
    const headers = fetchMock.mock.calls[0][1]?.headers as Record<string, string>;
    expect(headers["Idempotency-Key"]).toBe("k-12345678");
    expect(headers.Accept).toBe("application/json");
  });
});

/** JWT bicimli sahte token: yalnizca `exp` okunur, imza istemcide dogrulanmaz. */
function jwt(name: string, expSec: number) {
  const b64 = (o: object) => Buffer.from(JSON.stringify(o)).toString("base64url");
  return `${b64({ alg: "HS256" })}.${b64({ sub: name, exp: expSec })}.imza`;
}
const now = () => Math.floor(Date.now() / 1000);
const withHeaders = (status: number, body: unknown, h: Record<string, string> = {}) => ({
  ...json(status, body),
  headers: { get: (k: string) => h[k] ?? null },
});
const authOf = (init?: RequestInit) => (init?.headers as Record<string, string>).Authorization;

describe("suresi dolan token (inceleme hesabi, 2026-11-23)", () => {
  it("accessTokenExpiring: dolmus ve 30 sn icinde dolacak token; okunamayan token false", () => {
    const { accessTokenExpiring } = freshApi();
    expect(accessTokenExpiring(jwt("a", now() - 10))).toBe(true);
    expect(accessTokenExpiring(jwt("a", now() + 10))).toBe(true);
    expect(accessTokenExpiring(jwt("a", now() + 600))).toBe(false);
    expect(accessTokenExpiring("opak-token")).toBe(false);
  });

  it("dolmus token istekten ONCE tek ucusta yenilenir; iki istek tek refresh", async () => {
    const { api, saveTokens } = freshApi();
    await saveTokens(jwt("eski", now() - 60), "refresh-1");
    const fresh = jwt("yeni", now() + 900);
    fetchMock.mockImplementation(async (url: string, init?: RequestInit) => {
      if (url.endsWith("/auth/refresh")) {
        await new Promise((r) => setTimeout(r, 10));
        return json(200, { accessToken: fresh, refreshToken: "refresh-2" });
      }
      return withHeaders(200, { auth: authOf(init) });
    });
    const [a, b] = await Promise.all([
      api<{ auth: string }>("/shops/nearby", { optionalAuth: true }),
      api<{ auth: string }>("/bookings/me"),
    ]);
    expect(a.auth).toBe(`Bearer ${fresh}`);
    expect(b.auth).toBe(`Bearer ${fresh}`);
    expect(fetchMock.mock.calls.filter(([u]) => String(u).endsWith("/auth/refresh"))).toHaveLength(1);
  });

  it("istege bagli uc: yenileme reddedilirse istek ANONIM gider, oturum kapatilmaz", async () => {
    const { api, saveTokens, setSessionExpiredHandler } = freshApi();
    const expired = jest.fn();
    setSessionExpiredHandler(expired);
    await saveTokens(jwt("eski", now() - 60), "refresh-1");
    fetchMock.mockImplementation(async (url: string, init?: RequestInit) =>
      url.endsWith("/auth/refresh") ? json(401, { error: "unauthorized" }) : withHeaders(200, { auth: authOf(init) ?? null }),
    );
    const r = await api<{ auth: string | null }>("/shops/nearby", { optionalAuth: true });
    expect(r.auth).toBeNull();
    expect(expired).not.toHaveBeenCalled();
  });

  it("X-Auth-Stale: bir kez yenileyip tekrarlar, test dukkanlari ikinci yanitta gelir", async () => {
    const { api, saveTokens } = freshApi();
    // Istemci saatine gore gecerli ama sunucu reddetti (saat kaymasi / iptal).
    await saveTokens(jwt("eski", now() + 600), "refresh-1");
    const fresh = jwt("yeni", now() + 900);
    fetchMock.mockImplementation(async (url: string, init?: RequestInit) => {
      if (url.endsWith("/auth/refresh")) return json(200, { accessToken: fresh, refreshToken: "refresh-2" });
      return authOf(init) === `Bearer ${fresh}`
        ? withHeaders(200, ["gercek", "test"])
        : withHeaders(200, ["gercek"], { "X-Auth-Stale": "1" });
    });
    expect(await api<string[]>("/shops/nearby", { optionalAuth: true })).toEqual(["gercek", "test"]);
  });

  it("X-Auth-Stale ve yenileme reddi: anonim yanit kalir, oturum kapatilmaz", async () => {
    const { api, saveTokens, setSessionExpiredHandler } = freshApi();
    const expired = jest.fn();
    setSessionExpiredHandler(expired);
    await saveTokens(jwt("eski", now() + 600), "refresh-1");
    fetchMock.mockImplementation(async (url: string) =>
      url.endsWith("/auth/refresh") ? json(401, { error: "unauthorized" }) : withHeaders(200, ["gercek"], { "X-Auth-Stale": "1" }),
    );
    expect(await api<string[]>("/shops/nearby", { optionalAuth: true })).toEqual(["gercek"]);
    expect(expired).not.toHaveBeenCalled();
  });

  it("zorunlu uc: onceden reddedilen yenileme 401'de TEKRAR denenmez (refresh token iki kez yanmaz)", async () => {
    const { api, saveTokens, setSessionExpiredHandler } = freshApi();
    const expired = jest.fn();
    setSessionExpiredHandler(expired);
    await saveTokens(jwt("eski", now() - 60), "refresh-1");
    fetchMock.mockImplementation(async (url: string) =>
      url.endsWith("/auth/refresh") ? json(401, { error: "unauthorized" }) : withHeaders(401, { error: "unauthorized" }),
    );
    await expect(api("/bookings/me")).rejects.toMatchObject({ code: "session_expired" });
    expect(fetchMock.mock.calls.filter(([u]) => String(u).endsWith("/auth/refresh"))).toHaveLength(1);
    expect(expired).toHaveBeenCalledTimes(1);
  });
});
