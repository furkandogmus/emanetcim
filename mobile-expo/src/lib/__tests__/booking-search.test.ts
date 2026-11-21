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

  it("bos arama hicbir sey dondurmez", () => {
    expect(searchBookings(items, "   ")).toEqual([]);
  });
});
