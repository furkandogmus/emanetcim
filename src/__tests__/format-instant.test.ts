import { describe, it, expect, afterEach } from "vitest";
import { formatInstant } from "@/lib/format-datetime";

/**
 * `formatInstant`: an her zaman platform diliminde (İstanbul), etkin dilde.
 * Gece yarısına yakın bir UTC anı, dilim unutulursa GÜNÜ de kaydırır.
 */

// 2026-08-22 21:30 UTC = İstanbul'da 23 Ağustos 00:30.
const NEAR_MIDNIGHT = "2026-08-22T21:30:00.000Z";

const originalTz = process.env.TZ;
afterEach(() => {
  process.env.TZ = originalTz;
});

describe("formatInstant", () => {
  it("UTC anını İstanbul saatine ve gününe çevirir", () => {
    const out = formatInstant(NEAR_MIDNIGHT, "tr", {
      day: "2-digit",
      month: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
    expect(out).toMatch(/23[./]08/);
    expect(out).toContain("00:30");
  });

  it("dil varyantları kendi biçimini kullanır", () => {
    const opts = { year: "numeric", month: "2-digit", day: "2-digit" } as const;
    expect(formatInstant(NEAR_MIDNIGHT, "tr", opts)).toBe("23.08.2026");
    expect(formatInstant(NEAR_MIDNIGHT, "de", opts)).toBe("23.08.2026");
    expect(formatInstant(NEAR_MIDNIGHT, "en", opts)).toBe("08/23/2026");
    expect(formatInstant(NEAR_MIDNIGHT, "ja", opts)).toBe("2026/08/23");
    // BCP 47 etiketi de kabul edilir.
    expect(formatInstant(NEAR_MIDNIGHT, "en-US", opts)).toBe("08/23/2026");
  });

  it("sunucu (UTC) ve istemci (başka dilim) aynı metni üretir — hydration", () => {
    const outputs = new Set<string>();
    for (const tz of ["UTC", "Europe/Berlin", "America/New_York", "Asia/Tokyo"]) {
      process.env.TZ = tz;
      outputs.add(formatInstant(NEAR_MIDNIGHT, "tr"));
    }
    expect(outputs.size).toBe(1);
  });

  it("açık dilim verilirse onu kullanır", () => {
    expect(
      formatInstant(NEAR_MIDNIGHT, "tr", { hour: "2-digit", minute: "2-digit" }, "UTC"),
    ).toBe("21:30");
  });

  it("boş/geçersiz girdide çökmez, boş döner", () => {
    expect(formatInstant(null, "tr")).toBe("");
    expect(formatInstant("", "tr")).toBe("");
    expect(formatInstant("not-a-date", "tr")).toBe("");
  });
});
