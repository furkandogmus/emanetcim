/**
 * QR yerine elle arama: yerel liste, sunucu aramasi, hata durumunda liste tazeleme ve
 * "yalnizca gercekten eslesen tek satir kendiliginden acilir" kurali.
 */
import { describe, expect, it, jest } from "@jest/globals";

import { manualLookup } from "../manual-lookup";
import type { PartnerBooking } from "../types";

const row = (id: string, guestName: string) => ({ id, guestName }) as PartnerBooking;
const anna = row("abcd1234-0000", "Anna Schmidt");
const john = row("ffff0000-0000", "John Smith");
const ivan = row("9876aaaa-0000", "Ivan Petrov");

const never = () => Promise.reject(new Error("cagrilmamali"));

describe("manualLookup", () => {
  it("yuklu listede tek eslesme varsa sunucuya gitmeden acar", async () => {
    const searchServer = jest.fn(never);
    const r = await manualLookup("abcd1234", [anna, john], { searchServer, refetchList: never });
    expect(r.open?.id).toBe(anna.id);
    expect(searchServer).not.toHaveBeenCalled();
  });

  it("yerelde yoksa sunucuda arar ve bulunan tek satiri acar", async () => {
    const searchServer = jest.fn(async (_t: string) => [ivan]);
    const r = await manualLookup("#9876AAAA", [anna], { searchServer, refetchList: never });
    expect(searchServer).toHaveBeenCalledWith("9876AAAA");
    expect(r.open?.id).toBe(ivan.id);
  });

  it("arama ucu hata verirse liste tazelenip yerelde aranir", async () => {
    const refetchList = jest.fn(async () => [anna, ivan]);
    const r = await manualLookup("ivan", [anna], {
      searchServer: async () => {
        throw new Error("http_500");
      },
      refetchList,
    });
    expect(refetchList).toHaveBeenCalledTimes(1);
    expect(r.open?.id).toBe(ivan.id);
  });

  it("q'yu bilmeyen eski sunucunun tek satirlik listesini, eslesmiyorsa acmaz", async () => {
    const r = await manualLookup("abcd1234", [], { searchServer: async () => [john], refetchList: never });
    expect(r.open).toBeNull();
    expect(r.choices).toEqual([]);
  });

  it("telefonla gelen tek satir (satirda dogrulanamaz) acilmaz, aday olarak sunulur", async () => {
    const r = await manualLookup("5551234", [], { searchServer: async () => [john], refetchList: never });
    expect(r.open).toBeNull();
    expect(r.choices.map((c) => c.id)).toEqual([john.id]);
  });
});
