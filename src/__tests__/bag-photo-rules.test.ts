import { describe, it, expect } from "vitest";
import {
  BAG_PHOTO_EDIT_WINDOW_AFTER_CHECK_IN_MIN,
  bagPhotoDeleteAt,
  bagPhotoEditWindowOpen,
  bagPhotoRetentionDue,
  type RetentionSubject,
} from "@/lib/bag-photos";
import { stripJpegMetadata } from "@/lib/storage/jpeg-strip";

const DAY = 24 * 60 * 60 * 1000;
const NOW = new Date("2026-12-31T12:00:00Z");
const ago = (days: number) => new Date(NOW.getTime() - days * DAY);

function subject(over: Partial<RetentionSubject["booking"]> = {}, deletedAt: Date | null = null): RetentionSubject {
  return { deletedAt, booking: { status: "CHECKED_OUT", checkedOutAt: ago(31), updatedAt: ago(31), dispute: null, ...over } };
}

describe("duzenleme penceresi", () => {
  it("teslim oncesi acik, teslimden sonra kisa pencere, sonra kilitli", () => {
    expect(bagPhotoEditWindowOpen({ status: "APPROVED", checkedInAt: null }, NOW)).toBe(true);
    expect(bagPhotoEditWindowOpen({ status: "PAID", checkedInAt: null }, NOW)).toBe(true);
    const justNow = new Date(NOW.getTime() - (BAG_PHOTO_EDIT_WINDOW_AFTER_CHECK_IN_MIN - 1) * 60_000);
    const late = new Date(NOW.getTime() - (BAG_PHOTO_EDIT_WINDOW_AFTER_CHECK_IN_MIN + 1) * 60_000);
    expect(bagPhotoEditWindowOpen({ status: "CHECKED_IN", checkedInAt: justNow }, NOW)).toBe(true);
    expect(bagPhotoEditWindowOpen({ status: "CHECKED_IN", checkedInAt: late }, NOW)).toBe(false);
    expect(bagPhotoEditWindowOpen({ status: "CHECKED_OUT", checkedInAt: justNow }, NOW)).toBe(false);
    expect(bagPhotoEditWindowOpen({ status: "CANCELLED", checkedInAt: null }, NOW)).toBe(false);
  });
});

describe("saklama kurali", () => {
  it("itirazsiz: teslimden 30 gun sonra silinir, once silinmez", () => {
    expect(bagPhotoRetentionDue(subject({ checkedOutAt: ago(31) }), NOW)).toBe(true);
    expect(bagPhotoRetentionDue(subject({ checkedOutAt: ago(29) }), NOW)).toBe(false);
  });

  it("acik itiraz varken ne kadar eski olursa olsun silinmez", () => {
    for (const status of ["OPEN", "IN_REVIEW"]) {
      const s = subject({ checkedOutAt: ago(300), dispute: { status, updatedAt: ago(200) } });
      expect(bagPhotoDeleteAt(s)).toBeNull();
      expect(bagPhotoRetentionDue(s, NOW)).toBe(false);
    }
  });

  it("kapanan itiraz: kapanistan 30 gun sonra (teslimden gec olan)", () => {
    expect(bagPhotoRetentionDue(subject({ checkedOutAt: ago(90), dispute: { status: "RESOLVED", updatedAt: ago(10) } }), NOW)).toBe(false);
    expect(bagPhotoRetentionDue(subject({ checkedOutAt: ago(90), dispute: { status: "CLOSED", updatedAt: ago(31) } }), NOW)).toBe(true);
  });

  it("acik rezervasyon silinmez; iptal edilende son guncellemeden 30 gun", () => {
    expect(bagPhotoDeleteAt(subject({ status: "CHECKED_IN", checkedOutAt: null }))).toBeNull();
    expect(bagPhotoRetentionDue(subject({ status: "CANCELLED", checkedOutAt: null, updatedAt: ago(31) }), NOW)).toBe(true);
    expect(bagPhotoRetentionDue(subject({ status: "CANCELLED", checkedOutAt: null, updatedAt: ago(5) }), NOW)).toBe(false);
  });

  it("isaretlenmis (deletedAt) satir hemen silinir", () => {
    expect(bagPhotoRetentionDue(subject({ checkedOutAt: null, status: "CHECKED_IN" }, ago(0)), NOW)).toBe(true);
  });
});

/** Minimal JPEG: SOI, APP0, APP1(EXIF+GPS), COM, DQT, SOS, veri, EOI. */
function jpeg(): Uint8Array {
  const seg = (marker: number, payload: number[]) => [0xff, marker, (payload.length + 2) >> 8, (payload.length + 2) & 0xff, ...payload];
  const ascii = (s: string) => [...s].map((c) => c.charCodeAt(0));
  return new Uint8Array([
    0xff, 0xd8,
    ...seg(0xe0, [...ascii("JFIF"), 0, 1, 1, 0, 0, 1, 0, 1, 0, 0]),
    ...seg(0xe1, [...ascii("Exif"), 0, 0, ...ascii("GPS41.0N29.0E")]),
    ...seg(0xfe, ascii("secret comment")),
    ...seg(0xdb, [0, ...new Array(64).fill(1)]),
    0xff, 0xda, 0, 2, 0x11, 0x22, 0x33,
    0xff, 0xd9,
  ]);
}

describe("stripJpegMetadata", () => {
  it("EXIF/GPS ve yorumu atar, JFIF, tablo ve tarama verisini korur", () => {
    const out = stripJpegMetadata(jpeg())!;
    const text = String.fromCharCode(...out);
    expect(text).not.toContain("Exif");
    expect(text).not.toContain("GPS");
    expect(text).not.toContain("secret");
    expect(text).toContain("JFIF");
    expect(Array.from(out.slice(-5))).toEqual([0x11, 0x22, 0x33, 0xff, 0xd9]);
    expect(out[0]).toBe(0xff);
    expect(out[1]).toBe(0xd8);
  });

  it("JPEG olmayan ya da bozuk segmentte null", () => {
    expect(stripJpegMetadata(new Uint8Array([0x89, 0x50, 0x4e, 0x47]))).toBeNull();
    const broken = jpeg().slice(0, 12);
    expect(stripJpegMetadata(broken)).toBeNull();
  });
});
