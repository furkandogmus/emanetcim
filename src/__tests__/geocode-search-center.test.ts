import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { geocodeSearchCenterAction } from "@/actions/geocode-search-center";

/**
 * Misafir arama kutusuna yazarken canlı tetiklenen bir sunucu eylemi (bkz.
 * `SearchClient.tsx` debounce). Ücretsiz/hız-sınırlı bir üçüncü taraf servise
 * (Nominatim) sınırsız bekleyen bir `fetch` — yanıt vermezse arama kutusu
 * süresiz "yükleniyor" kalırdı, client'taki "bilinen şehir merkezine düş"
 * yedeğine hiç ulaşmadan.
 */
describe("geocodeSearchCenterAction", () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    global.fetch = originalFetch;
  });

  it("Nominatim hiç yanıt vermezse (asılı kalırsa) zaman aşımıyla { ok: false } döner", async () => {
    global.fetch = vi.fn(() => new Promise(() => {})) as unknown as typeof fetch;

    const promise = geocodeSearchCenterAction("Kadıköy", "tr");
    await vi.advanceTimersByTimeAsync(5000);

    await expect(promise).resolves.toEqual({ ok: false });
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
