import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { stripComments } from "./helpers/strip-comments";
import { GUEST_PUSH_COPY } from "@/lib/guest-push-copy";

/**
 * BIRAKIS HATIRLATMASI APPROVED REZERVASYONA DA GIDER, E-POSTASIZ MISAFIRE PUSH.
 *
 * Misafir akislari rezervasyonu `APPROVED` olusturur, tahsilat check-in'de
 * (`PAID`) yapilir; sorgu yalnizca `PAID` seciyordu, yani birakis hatirlatmasi
 * hicbir rezervasyona gitmiyordu. Telefonla kayitli misafirin e-postasi yok:
 * push e-posta dalinin icindeydi, onlara hic gitmiyordu. Push-only dalin tekrar
 * kontrolu `MOBILE_PUSH` kaydina dayanir (15 dk periyot x 120 dk pencere).
 */
const src = stripComments(
  readFileSync(join(process.cwd(), "src/app/api/internal/booking-reminders/route.ts"), "utf-8"),
);

describe("booking-reminders", () => {
  it("birakis penceresi APPROVED ve PAID secer", () => {
    expect(src).toMatch(/status: \{ in: \["APPROVED", "PAID"\] \}/);
  });

  it("e-postasiz misafire push gonderir ve push tekrarini kontrol eder", () => {
    expect(src).toContain('pushGuestOnly(booking.id, "reminderCheckIn"');
    expect(src).toContain('pushGuestOnly(booking.id, "reminderCheckOut"');
    expect(src).toContain("checkInPushed.has(booking.id)");
    expect(src).toContain("checkOutPushed.has(booking.id)");
  });

  it("tekrar kontrolunun anahtari olan push basliklari her dilde dolu", () => {
    for (const copy of Object.values(GUEST_PUSH_COPY)) {
      expect(copy.reminderCheckIn({ shop: "" }).title.length).toBeGreaterThan(0);
      expect(copy.reminderCheckOut({ shop: "" }).title.length).toBeGreaterThan(0);
    }
  });
});
