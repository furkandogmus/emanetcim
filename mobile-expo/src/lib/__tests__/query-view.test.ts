/**
 * Arka plan yenilemesi basarisiz olunca (30 sn'lik poll) dolu liste silinmemeli:
 * tam ekran hata yalnizca veri yokken, veri varken sadece ince bant.
 */
import { describe, expect, it } from "@jest/globals";
import { ApiError } from "../api";
import { isBlockingError, isStaleError } from "../query-view";

describe("query-view", () => {
  it("veri yokken hata engelleyicidir", () => {
    const q = { isError: true, data: undefined };
    expect(isBlockingError(q)).toBe(true);
    expect(isStaleError(q)).toBe(false);
  });

  it("veri varken hata yalnizca bayatlik bildirir, listeyi silmez", () => {
    const q = { isError: true, data: [{ id: "b1" }] };
    expect(isBlockingError(q)).toBe(false);
    expect(isStaleError(q)).toBe(true);
  });

  it("bos liste de veridir: hata yine banttir", () => {
    const q = { isError: true, data: [] as unknown[] };
    expect(isBlockingError(q)).toBe(false);
    expect(isStaleError(q)).toBe(true);
  });

  it("hata yoksa ikisi de kapali", () => {
    expect(isBlockingError({ isError: false, data: undefined })).toBe(false);
    expect(isStaleError({ isError: false, data: [1] })).toBe(false);
  });

  it("ag ve sunucu hatasi gecicidir: veri korunur", () => {
    for (const status of [0, 500, 503]) {
      const q = { isError: true, data: { id: "b1" }, error: new ApiError(status, "network") };
      expect(isBlockingError(q)).toBe(false);
      expect(isStaleError(q)).toBe(true);
    }
  });

  it("404/403 kalicidir: eski veri gosterilmez", () => {
    for (const status of [403, 404]) {
      const q = { isError: true, data: { id: "b1" }, error: new ApiError(status, "not_found") };
      expect(isBlockingError(q)).toBe(true);
      expect(isStaleError(q)).toBe(false);
    }
  });
});
