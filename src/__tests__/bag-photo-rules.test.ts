import { describe, it, expect } from "vitest";
import {
  BAG_PHOTO_EDIT_WINDOW_AFTER_CHECK_IN_MIN,
  bagPhotoDeleteAt,
  bagPhotoEditWindowOpen,
  bagPhotoRetentionDue,
  type RetentionSubject,
} from "@/lib/bag-photos";
import { stripJpegMetadata } from "@/lib/storage/jpeg-strip";
import { readImageDimensions, sniffImageKind } from "@/lib/storage/image-validation";

const DAY = 24 * 60 * 60 * 1000;
const NOW = new Date("2026-12-31T12:00:00Z");
const ago = (days: number) => new Date(NOW.getTime() - days * DAY);

function subject(over: Partial<RetentionSubject["booking"]> = {}, deletedAt: Date | null = null): RetentionSubject {
  return {
    deletedAt,
    booking: { status: "CHECKED_OUT", checkedOutAt: ago(31), checkOutTime: ago(31), updatedAt: ago(31), dispute: null, ...over },
  };
}

const FUTURE = new Date(NOW.getTime() + DAY);
describe("duzenleme penceresi", () => {
  it("teslim oncesi acik, teslimden sonra kisa pencere, sonra kilitli", () => {
    expect(bagPhotoEditWindowOpen({ status: "APPROVED", checkedInAt: null, checkOutTime: FUTURE }, NOW)).toBe(true);
    expect(bagPhotoEditWindowOpen({ status: "PAID", checkedInAt: null, checkOutTime: FUTURE }, NOW)).toBe(true);
    const justNow = new Date(NOW.getTime() - (BAG_PHOTO_EDIT_WINDOW_AFTER_CHECK_IN_MIN - 1) * 60_000);
    const late = new Date(NOW.getTime() - (BAG_PHOTO_EDIT_WINDOW_AFTER_CHECK_IN_MIN + 1) * 60_000);
    expect(bagPhotoEditWindowOpen({ status: "CHECKED_IN", checkedInAt: justNow, checkOutTime: FUTURE }, NOW)).toBe(true);
    expect(bagPhotoEditWindowOpen({ status: "CHECKED_IN", checkedInAt: late, checkOutTime: FUTURE }, NOW)).toBe(false);
    expect(bagPhotoEditWindowOpen({ status: "CHECKED_OUT", checkedInAt: justNow, checkOutTime: FUTURE }, NOW)).toBe(false);
    expect(bagPhotoEditWindowOpen({ status: "CANCELLED", checkedInAt: null, checkOutTime: FUTURE }, NOW)).toBe(false);
  });

  it("teslim alinmamis rezervasyonda planli bitis gecince kapanir", () => {
    expect(bagPhotoEditWindowOpen({ status: "APPROVED", checkedInAt: null, checkOutTime: ago(0.01) }, NOW)).toBe(false);
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

  it("hic kapanmamis rezervasyon planli bitisten 30 gun sonra; iptal edilende son guncellemeden 30 gun", () => {
    expect(bagPhotoRetentionDue(subject({ status: "CHECKED_IN", checkedOutAt: null, checkOutTime: ago(29) }), NOW)).toBe(false);
    expect(bagPhotoRetentionDue(subject({ status: "CHECKED_IN", checkedOutAt: null, checkOutTime: ago(31) }), NOW)).toBe(true);
    expect(bagPhotoRetentionDue(subject({ status: "APPROVED", checkedOutAt: null, checkOutTime: ago(31) }), NOW)).toBe(true);
    expect(
      bagPhotoRetentionDue(subject({ status: "CHECKED_IN", checkedOutAt: null, checkOutTime: ago(300), dispute: { status: "OPEN", updatedAt: ago(1) } }), NOW),
    ).toBe(false);
    expect(bagPhotoRetentionDue(subject({ status: "CANCELLED", checkedOutAt: null, updatedAt: ago(31) }), NOW)).toBe(true);
    expect(bagPhotoRetentionDue(subject({ status: "CANCELLED", checkedOutAt: null, updatedAt: ago(5) }), NOW)).toBe(false);
  });

  it("isaretlenmis (deletedAt) satir hemen silinir", () => {
    expect(bagPhotoRetentionDue(subject({ checkedOutAt: null, status: "CHECKED_IN", checkOutTime: FUTURE }, ago(0)), NOW)).toBe(true);
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

describe("stripJpegMetadata: tarama sonrasi ve EOI sonrasi", () => {
  const seg = (marker: number, payload: number[]) => [0xff, marker, (payload.length + 2) >> 8, (payload.length + 2) & 0xff, ...payload];
  const ascii = (str: string) => [...str].map((c) => c.charCodeAt(0));
  const sof = seg(0xc2, [8, 0, 32, 0, 48, 1, 1, 0x11, 0]); // progresif, 48x32
  const scan = (data: number[]) => [...seg(0xda, [1, 1, 0, 0, 63, 0]), ...data];
  const gps = seg(0xe1, [...ascii("Exif"), 0, 0, ...ascii("GPS41.0N29.0E")]);
  const text = (b: Uint8Array) => String.fromCharCode(...b);

  /** Cikti yeniden ayristirilabilir: SOI, SOF okunur, tek EOI ile biter, ikinci geciste degismez. */
  function assertValid(out: Uint8Array) {
    expect(sniffImageKind(out)).toBe("jpeg");
    expect(readImageDimensions(out, "jpeg")).toEqual({ width: 48, height: 32 });
    expect(Array.from(out.slice(-2))).toEqual([0xff, 0xd9]);
    expect(stripJpegMetadata(out)).toEqual(out);
  }

  it("EOI sonrasi MPF ikincil goruntusu ve GPS'i atilir, cikti ilk EOI'de biter", () => {
    const mpf = seg(0xe2, [...ascii("MPF"), 0, 1, 2, 3]);
    const secondary = [0xff, 0xd8, ...gps, ...sof, ...scan([0x55]), 0xff, 0xd9];
    const input = new Uint8Array([0xff, 0xd8, ...mpf, ...sof, ...scan([0x10, 0xff, 0x00, 0x20]), 0xff, 0xd9, ...secondary, ...ascii("<script>")]);
    const out = stripJpegMetadata(input)!;
    expect(text(out)).not.toContain("GPS");
    expect(text(out)).not.toContain("MPF");
    expect(text(out)).not.toContain("<script>");
    expect(out.filter((b, i) => b === 0xff && out[i + 1] === 0xd8).length).toBe(1);
    assertValid(out);
  });

  it("progresif taramalar arasindaki APP1/COM atilir, iki tarama ve aradaki DHT korunur", () => {
    const dht = seg(0xc4, [0x00, ...new Array(16).fill(0)]);
    const input = new Uint8Array([
      0xff, 0xd8, ...sof, ...scan([0x11, 0xff, 0xd0, 0x12]), ...gps, ...seg(0xfe, ascii("note")), ...dht, ...scan([0x13]), 0xff, 0xd9,
    ]);
    const out = stripJpegMetadata(input)!;
    expect(text(out)).not.toContain("GPS");
    expect(text(out)).not.toContain("note");
    const sosCount = Array.from(out).filter((b, i) => b === 0xff && out[i + 1] === 0xda).length;
    expect(sosCount).toBe(2);
    expect(Array.from(out)).toEqual(expect.arrayContaining([0x11, 0xd0, 0x12, 0x13]));
    assertValid(out);
  });

  it("EOI'siz kesik dosya reddedilir", () => {
    expect(stripJpegMetadata(new Uint8Array([0xff, 0xd8, ...sof, ...scan([0x11, 0x22])]))).toBeNull();
  });
});
