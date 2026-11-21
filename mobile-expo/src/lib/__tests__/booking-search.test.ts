import { describe, expect, it } from "@jest/globals";

import { bookingCode, searchBookings } from "../booking-search";
import type { PartnerBooking } from "../types";

function b(id: string, guestName: string): PartnerBooking {
  return { id, guestName } as PartnerBooking;
}

const items = [b("abcd1234-ffff", "Anna Schmidt"), b("abcd9999-0000", "John Smith"), b("zz001122-1111", "Ivan Petrov")];

describe("esnaf rezervasyon aramasi", () => {
  it("kod fisteki gibi: ilk 8 hane, buyuk harf", () => {
    expect(bookingCode("abcd1234-ffff")).toBe("ABCD1234");
  });

  it("8 haneli kodla tek kayit bulur (harf ve tire farki onemsiz)", () => {
    expect(searchBookings(items, "abcd-1234").map((x) => x.id)).toEqual(["abcd1234-ffff"]);
    expect(searchBookings(items, "ZZ001122")).toHaveLength(1);
  });

  it("kisa on ek birden fazla kayda uyar; misafir secer", () => {
    expect(searchBookings(items, "abcd")).toHaveLength(2);
  });

  it("misafir adinin herhangi bir parcasiyla bulur", () => {
    expect(searchBookings(items, "schmidt")).toHaveLength(1);
    expect(searchBookings(items, "PETR")).toHaveLength(1);
  });

  it("buyuk harfle yazilan I/i iceren adlar bulunur (klavye otomatik buyuk harf gonderir)", () => {
    const list = [b("11110000-aaaa", "Ali Yilmaz"), b("22220000-bbbb", "John Smith"), b("33330000-cccc", "Dmitri Ivanov"), b("44440000-dddd", "İpek Kaya")];
    expect(searchBookings(list, "ALI").map((x) => x.id)).toEqual(["11110000-aaaa"]);
    expect(searchBookings(list, "SMITH")).toHaveLength(1);
    expect(searchBookings(list, "DMITRI")).toHaveLength(1);
    expect(searchBookings(list, "IPEK")).toHaveLength(1);
    expect(searchBookings(list, "ipek")).toHaveLength(1);
  });

  it("bos arama hicbir sey dondurmez", () => {
    expect(searchBookings(items, "   ")).toEqual([]);
  });
});
