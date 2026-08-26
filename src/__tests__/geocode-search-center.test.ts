import { describe, it, expect, vi, afterEach } from "vitest";
import { geocodeSearchCenterAction } from "@/actions/geocode-search-center";

/**
 * Misafir arama kutusuna yazarken canlı tetiklenen bir sunucu eylemi (bkz.
 * `SearchClient.tsx` debounce). Ücretsiz/hız-sınırlı bir üçüncü taraf servise
 * (Nominatim) sınırsız bekleyen bir `fetch` — yanıt vermezse arama kutusu
 * süresiz "yükleniyor" kalırdı, client'taki "bilinen şehir merkezine düş"
 * yedeğine hiç ulaşmadan.
 *
 * Artık `fetchWithTimeout`: vazgeçmekle kalmaz, isteği İPTAL EDER. Aksi hâlde
 * her tuş vuruşu terk edilmiş bir soket bırakırdı.
 */
describe("geocodeSearchCenterAction", () => {
  const originalFetch = global.fetch;

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it("her istek bir iptal sinyaliyle çıkar — asılı kalan istek soket sızdırmaz", async () => {
    const spy = vi.fn(async (_url: string | URL, init: RequestInit) => {
      expect(init.signal).toBeInstanceOf(AbortSignal);
      return {
        ok: true,
        json: async () => [{ lat: "40.99", lon: "29.02", display_name: "x" }],
      } as unknown as Response;
    });
    global.fetch = spy as unknown as typeof fetch;

    await geocodeSearchCenterAction("Kadıköy", "tr");

    expect(spy).toHaveBeenCalledOnce();
  });

  it("Nominatim hiç yanıt vermezse (zaman aşımı) { ok: false } döner", async () => {
    /*
      Süre dolduğunda ÇALIŞMA ZAMANININ ürettiği hata bu: `fetchWithTimeout`
      isteği `AbortSignal.timeout` ile sonlandırır ve etiketli bir hataya
      normalize eder. Sahte zamanlayıcıyla sürülemez — `AbortSignal.timeout`
      Node'un iç zamanlayıcısını kullanır, `vi.advanceTimersByTime` onu
      tetiklemez (ölçüldü). Zaman aşımının KENDİSİ
      `src/lib/async-timeout.test.ts`'te; burada ölçülen şey, o hata geldiğinde
      arama kutusunun süresiz "yükleniyor" kalmayıp client'taki "bilinen şehir
      merkezine düş" yedeğine ULAŞMASI.
    */
    global.fetch = vi.fn(() =>
      Promise.reject(new Error("geocode_search_timeout_after_5000ms")),
    ) as unknown as typeof fetch;

    await expect(geocodeSearchCenterAction("Kadıköy", "tr")).resolves.toEqual({
      ok: false,
    });
  });

  it("başarılı yanıtta koordinatları döner", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => [{ lat: "40.99", lon: "29.02", display_name: "Kadıköy, İstanbul" }],
    }) as unknown as typeof fetch;

    const result = await geocodeSearchCenterAction("Kadıköy", "tr");

    expect(result).toEqual({ ok: true, lat: 40.99, lng: 29.02, label: "Kadıköy, İstanbul" });
  });

  it("kısa sorguyu (3 karakterden az) hiç ağa çıkmadan reddeder", async () => {
    global.fetch = vi.fn() as unknown as typeof fetch;

    const result = await geocodeSearchCenterAction("ka", "tr");

    expect(result).toEqual({ ok: false });
    expect(global.fetch).not.toHaveBeenCalled();
  });
});
