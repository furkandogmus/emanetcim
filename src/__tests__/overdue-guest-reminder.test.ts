import { describe, it, expect } from "vitest";
import {
  dueOverdueGuestReminderSlot,
  nextOverdueGuestReminderSlot,
  OVERDUE_GUEST_REMINDER_MAX,
} from "@/lib/overdue-guest-reminder";

const MIN = 60_000;
const HOUR = 60 * MIN;

/** Misafire gecikme hatirlatmasi takvimi: +30 dk, +24 sa, sonra gunde bir, en fazla 7. */
describe("misafir gecikme hatirlatmasi takvimi", () => {
  it("ilk hatirlatma 30. dakikada: 29 dk'da yok, 31 dk'da var", () => {
    expect(dueOverdueGuestReminderSlot(29 * MIN)).toBe(0);
    expect(dueOverdueGuestReminderSlot(30 * MIN)).toBe(1);
    expect(dueOverdueGuestReminderSlot(31 * MIN)).toBe(1);
    expect(nextOverdueGuestReminderSlot(29 * MIN, [])).toBeNull();
    expect(nextOverdueGuestReminderSlot(31 * MIN, [])).toBe(1);
  });

  it("ikinci hatirlatma 24. saatte, oncesinde sessiz", () => {
    expect(nextOverdueGuestReminderSlot(23 * HOUR + 59 * MIN, [1])).toBeNull();
    expect(nextOverdueGuestReminderSlot(24 * HOUR, [1])).toBe(2);
  });

  it("sonra 24 saatte bir: 47 sa'te ucuncu yok, 48 sa'te var", () => {
    expect(nextOverdueGuestReminderSlot(47 * HOUR, [1, 2])).toBeNull();
    expect(nextOverdueGuestReminderSlot(48 * HOUR, [1, 2])).toBe(3);
  });

  it("toplam en fazla 7: yedinci 144. saatte, sonrasi hicbir zaman", () => {
    expect(OVERDUE_GUEST_REMINDER_MAX).toBe(7);
    expect(dueOverdueGuestReminderSlot(143 * HOUR)).toBe(6);
    expect(dueOverdueGuestReminderSlot(144 * HOUR)).toBe(7);
    expect(dueOverdueGuestReminderSlot(24 * 365 * HOUR)).toBe(7);
    const all = [1, 2, 3, 4, 5, 6, 7];
    expect(nextOverdueGuestReminderSlot(168 * HOUR, all)).toBeNull();
    expect(nextOverdueGuestReminderSlot(24 * 30 * HOUR, all)).toBeNull();
  });

  it("ayni slot ikinci kez istenmez", () => {
    expect(nextOverdueGuestReminderSlot(31 * MIN, [1])).toBeNull();
    expect(nextOverdueGuestReminderSlot(25 * HOUR, [1, 2])).toBeNull();
  });

  it("is durduysa kacirilan slotlar ard arda gonderilmez, yalnizca guncel olan", () => {
    // 3 gun hic calismadi: 1 gonderilmis, simdi 74. saat -> tek hatirlatma (slot 4).
    expect(nextOverdueGuestReminderSlot(74 * HOUR, [1])).toBe(4);
  });

  it("bozuk sure hatirlatma uretmez", () => {
    expect(dueOverdueGuestReminderSlot(Number.NaN)).toBe(0);
    expect(nextOverdueGuestReminderSlot(Number.NaN, [])).toBeNull();
  });
});
