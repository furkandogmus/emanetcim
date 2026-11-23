import { describe, it, expect } from "vitest";
import {
  decideLateHold,
  isSilentBacklog,
  lateCloseAt,
  nextLateReminderStage,
  type LateSubject,
} from "@/lib/late-dropoff";

/** Gec birakma kuralinin saf cekirdegi (`src/lib/late-dropoff.ts`). */

const CHECK_IN = new Date("2030-05-01T10:00:00Z");
const CHECK_OUT = new Date("2030-05-01T12:00:00Z");
const min = (n: number) => new Date(CHECK_IN.getTime() + n * 60_000);

function b(over: Partial<LateSubject> = {}): LateSubject {
  return { status: "PAID", checkInTime: CHECK_IN, checkOutTime: CHECK_OUT, checkedInAt: null, lateHoldUntil: null, ...over };
}

describe("nextLateReminderStage: asama zamanlamasi", () => {
  it("birakma +15 dk'dan once hicbir sey gitmez", () => {
    expect(nextLateReminderStage(b(), min(0), [])).toBeNull();
    expect(nextLateReminderStage(b(), min(14), [])).toBeNull();
  });

  it("her asama kendi penceresinde: 15-30 -> 1, 30-45 -> 2, 45-60 -> 3", () => {
    expect(nextLateReminderStage(b(), min(15), [])).toBe(1);
    expect(nextLateReminderStage(b(), min(29), [])).toBe(1);
    expect(nextLateReminderStage(b(), min(30), [1])).toBe(2);
    expect(nextLateReminderStage(b(), min(45), [1, 2])).toBe(3);
    expect(nextLateReminderStage(b(), min(59), [1, 2])).toBe(3);
  });

  it("5 dk'lik tarama ayni asamayi iki kez gondermez", () => {
    expect(nextLateReminderStage(b(), min(20), [1])).toBeNull();
    expect(nextLateReminderStage(b(), min(25), [1])).toBeNull();
    expect(nextLateReminderStage(b(), min(50), [3])).toBeNull();
  });

  it("yetisme yagmuru yok: kacirilan asama atlanir, yalniz guncel olan gider", () => {
    // Cron 40 dk calismadi: +50'de yalnizca 3. asama; 1 ve 2 hic gitmez.
    expect(nextLateReminderStage(b(), min(50), [])).toBe(3);
    // 3 yazildiktan sonra geride kalanlar da gitmez.
    expect(nextLateReminderStage(b(), min(55), [3])).toBeNull();
  });

  it("kapanis anindan (+60) sonra hatirlatma yok", () => {
    expect(nextLateReminderStage(b(), min(60), [])).toBeNull();
    expect(nextLateReminderStage(b(), min(600), [])).toBeNull();
  });

  it("bekletme surerken hatirlatma yok", () => {
    expect(nextLateReminderStage(b({ lateHoldUntil: min(90) }), min(35), [1])).toBeNull();
  });
});

describe("lateCloseAt", () => {
  it("bekletme yoksa birakma + 60 dk; bekletme varsa bekletmenin sonu", () => {
    expect(lateCloseAt(b())).toEqual(min(60));
    expect(lateCloseAt(b({ lateHoldUntil: min(90) }))).toEqual(min(90));
  });

  it("valizi birakilmis ya da kapanmis rezervasyonda null", () => {
    expect(lateCloseAt(b({ checkedInAt: min(5) }))).toBeNull();
    expect(lateCloseAt(b({ status: "CHECKED_IN" }))).toBeNull();
    expect(lateCloseAt(b({ status: "CANCELLED" }))).toBeNull();
  });

  it("odemesiz niyet (PENDING) de kapanir", () => {
    expect(lateCloseAt(b({ status: "PENDING" }))).toEqual(min(60));
  });
});

describe("decideLateHold: Misafiri bekle", () => {
  it("ilk basis: max(simdi, kapanis) + 30 dk", () => {
    expect(decideLateHold(b(), min(45))).toEqual({ ok: true, until: min(90), previousCloseAt: min(60) });
  });

  it("tekrar basilabilir; her basis mevcut kapanistan 30 dk ileri", () => {
    expect(decideLateHold(b({ lateHoldUntil: min(90) }), min(50))).toMatchObject({ ok: true, until: min(120) });
  });

  it("kapanis gecmisse (tarama henuz kapatmadi) simdiden 30 dk", () => {
    expect(decideLateHold(b(), min(62))).toMatchObject({ ok: true, until: min(92) });
  });

  it("alma saatini asamaz; tavana dayandiysa HOLD_LIMIT", () => {
    expect(decideLateHold(b({ lateHoldUntil: min(100) }), min(50))).toMatchObject({ ok: true, until: CHECK_OUT });
    expect(decideLateHold(b({ lateHoldUntil: CHECK_OUT }), min(50))).toEqual({ ok: false, code: "HOLD_LIMIT" });
  });

  it("birakma saatinden once TOO_EARLY; valiz birakildiysa ya da odemesiz niyetse INVALID_STATUS", () => {
    expect(decideLateHold(b(), min(-5))).toEqual({ ok: false, code: "TOO_EARLY" });
    expect(decideLateHold(b({ checkedInAt: min(10) }), min(20))).toEqual({ ok: false, code: "INVALID_STATUS" });
    expect(decideLateHold(b({ status: "PENDING" }), min(20))).toEqual({ ok: false, code: "INVALID_STATUS" });
  });
});

describe("isSilentBacklog", () => {
  it("kapanisi 2 saatten eski kayit sessiz kapanir", () => {
    expect(isSilentBacklog(min(60), min(65))).toBe(false);
    expect(isSilentBacklog(min(60), min(180))).toBe(false);
    expect(isSilentBacklog(min(60), min(181))).toBe(true);
  });
});
