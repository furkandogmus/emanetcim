import { describe, it, expect, vi, afterEach } from "vitest";
import { withTimeout, fetchWithTimeout } from "./async-timeout";

/**
 * Bu dosyanin iki fonksiyonu AYNI SEYI YAPMIYOR ve fark guvenilirlik acisindan
 * onemli: `withTimeout` yalnizca vazgecer, `fetchWithTimeout` istegi gercekten
 * sonlandirir. Test tam olarak bu farki olcuyor — yoksa ikisi ayni isim
 * gorunumunde birbirinin yerine kullanilir ve terk edilmis soket sorunu geri
 * gelir.
 */

const realFetch = globalThis.fetch;

afterEach(() => {
  globalThis.fetch = realFetch;
  vi.restoreAllMocks();
});

describe("withTimeout", () => {
  it("suresinde biten isi oldugu gibi dondurur", async () => {
    await expect(withTimeout(Promise.resolve("ok"), 50, "x")).resolves.toBe("ok");
  });

  it("sure dolunca etiketi iceren hatayla reddeder", async () => {
    const never = new Promise<never>(() => {});
    await expect(withTimeout(never, 10, "slow_thing")).rejects.toThrow(
      "slow_thing_timeout_after_10ms",
    );
  });
});

describe("fetchWithTimeout", () => {
  it("istegi AbortSignal ile donatir — vazgecmek yetmez, iptal de edilmeli", async () => {
    const spy = vi.fn(async (_url: string | URL, init: RequestInit) => {
      expect(init.signal).toBeInstanceOf(AbortSignal);
      return new Response("{}", { status: 200 });
    });
    globalThis.fetch = spy as unknown as typeof fetch;

    const res = await fetchWithTimeout("https://example.test", {}, 1000, "probe");
    expect(res.status).toBe(200);
    expect(spy).toHaveBeenCalledOnce();
  });

  it("cagiranin verdigi init alanlarini korur", async () => {
    const spy = vi.fn(async (_url: string | URL, init: RequestInit) => {
      expect(init.method).toBe("POST");
      expect(init.body).toBe("payload");
      return new Response(null, { status: 204 });
    });
    globalThis.fetch = spy as unknown as typeof fetch;

    await fetchWithTimeout(
      "https://example.test",
      { method: "POST", body: "payload" },
      1000,
      "probe",
    );
  });

  it("zaman asiminda `withTimeout` ile AYNI hata metnini uretir", async () => {
    // Gercek bir askida kalan istek: yalnizca signal'in abort'uyla biter.
    globalThis.fetch = ((_url: string | URL, init: RequestInit) =>
      new Promise((_resolve, reject) => {
        init.signal?.addEventListener("abort", () => {
          // undici'nin AbortSignal.timeout icin urettigi hata bicimi.
          const err = new Error("The operation was aborted due to timeout");
          err.name = "TimeoutError";
          reject(err);
        });
      })) as unknown as typeof fetch;

    await expect(
      fetchWithTimeout("https://example.test", {}, 20, "geocode_search"),
    ).rejects.toThrow("geocode_search_timeout_after_20ms");
  });

  it("zaman asimi DISI hatalari oldugu gibi birakir (yutmaz, maskelemez)", async () => {
    globalThis.fetch = (() =>
      Promise.reject(new Error("ECONNREFUSED"))) as unknown as typeof fetch;

    await expect(
      fetchWithTimeout("https://example.test", {}, 1000, "probe"),
    ).rejects.toThrow("ECONNREFUSED");
  });
});
