import { describe, it, expect } from "vitest";
import type { BookingStatus } from "@prisma/client";
import {
  bookingMatchesPartnerFilter,
  partnerBookingsFilterStatuses,
  parsePartnerBookingsFilter,
  type PartnerBookingsFilter,
} from "@/lib/partner-bookings-filter";

/**
 * NEDEN (2026-08-25): `partner/bookings/page.tsx`, `filter`i ayrıştırıp
 * yalnızca URL/aktif-sekme gösterimi için kullanıyordu — sorgunun `where`
 * koşuluna HİÇ eklenmiyordu. Partner "Ödeme Bekleyen" sekmesine tıkladığında
 * sunucu her zaman AYNI, filtrelenmemiş tam listeyi döndürüyordu; sekmeler
 * görsel olarak seçili görünüyor ama hiçbir şeyi değiştirmiyordu.
 *
 * Bu test dosyası önce `bookingMatchesPartnerFilter` için hiç test yoktu —
 * bug hiçbir taramada yakalanmadı çünkü altındaki mantık hiç test edilmemişti.
 */

const ALL_STATUSES: BookingStatus[] = [
  "PENDING",
  "WAITING_APPROVAL",
  "APPROVED",
  "PAID",
  "CHECKED_IN",
  "CHECKED_OUT",
  "CANCELLED",
];

describe("bookingMatchesPartnerFilter", () => {
  it("'all' her durumu eşleştirir", () => {
    for (const s of ALL_STATUSES) {
      expect(bookingMatchesPartnerFilter(s, "all")).toBe(true);
    }
  });

  it("'action' yalnızca WAITING_APPROVAL/PAID/CHECKED_IN'i eşleştirir", () => {
    expect(bookingMatchesPartnerFilter("WAITING_APPROVAL", "action")).toBe(true);
    expect(bookingMatchesPartnerFilter("PAID", "action")).toBe(true);
    expect(bookingMatchesPartnerFilter("CHECKED_IN", "action")).toBe(true);
    expect(bookingMatchesPartnerFilter("PENDING", "action")).toBe(false);
    expect(bookingMatchesPartnerFilter("CHECKED_OUT", "action")).toBe(false);
  });

  it("'payment' yalnızca PENDING/APPROVED'ı eşleştirir", () => {
    expect(bookingMatchesPartnerFilter("PENDING", "payment")).toBe(true);
    expect(bookingMatchesPartnerFilter("APPROVED", "payment")).toBe(true);
    expect(bookingMatchesPartnerFilter("PAID", "payment")).toBe(false);
  });

  it("'done' yalnızca CHECKED_OUT/CANCELLED'ı eşleştirir", () => {
    expect(bookingMatchesPartnerFilter("CHECKED_OUT", "done")).toBe(true);
    expect(bookingMatchesPartnerFilter("CANCELLED", "done")).toBe(true);
    expect(bookingMatchesPartnerFilter("PAID", "done")).toBe(false);
  });
});

describe("partnerBookingsFilterStatuses", () => {
  it("'all' için undefined döner (Prisma where'e koşul eklenmesin diye)", () => {
    expect(partnerBookingsFilterStatuses("all")).toBeUndefined();
  });

  it.each<[PartnerBookingsFilter, BookingStatus[]]>([
    ["action", ["WAITING_APPROVAL", "PAID", "CHECKED_IN"]],
    ["payment", ["PENDING", "APPROVED"]],
    ["done", ["CHECKED_OUT", "CANCELLED"]],
  ])("%s için doğru durum kümesini döner", (filter, expected) => {
    expect(partnerBookingsFilterStatuses(filter)).toEqual(expected);
  });

  /**
   * Çapraz tutarlılık: `bookingMatchesPartnerFilter`in "evet" dediği her
   * durum, `partnerBookingsFilterStatuses`in döndürdüğü kümede de olmalı —
   * aksi halde ikisi ayrı tanımlanmış olur ve zamanla birbirinden sapabilir
   * (tam da bu bug'ın kök nedeni).
   */
  it("her filtre için iki fonksiyon aynı durum kümesinde anlaşır", () => {
    for (const filter of ["action", "payment", "done"] as const) {
      const statuses = partnerBookingsFilterStatuses(filter)!;
      for (const s of ALL_STATUSES) {
        expect(bookingMatchesPartnerFilter(s, filter)).toBe(statuses.includes(s));
      }
    }
  });
});

describe("parsePartnerBookingsFilter", () => {
  it("geçersiz/eksik değeri 'all'a düşürür", () => {
    expect(parsePartnerBookingsFilter(undefined)).toBe("all");
    expect(parsePartnerBookingsFilter("garbage")).toBe("all");
  });

  it("geçerli değerleri olduğu gibi kabul eder", () => {
    expect(parsePartnerBookingsFilter("action")).toBe("action");
    expect(parsePartnerBookingsFilter("payment")).toBe("payment");
    expect(parsePartnerBookingsFilter("done")).toBe("done");
  });
});
