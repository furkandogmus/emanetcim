import { describe, expect, it } from "@jest/globals";

import { nextRange } from "@/lib/date-range";

const d = (day: number) => new Date(2026, 9, day);

describe("nextRange", () => {
  it("tek gün seçiliyken ileri bir güne dokunmak aralığı uzatır", () => {
    // Ekran 19 seçili açılır, misafir bitiş günü olarak 22'ye dokunur.
    const r = nextRange(d(19), d(19), d(22), "start", 30);
    expect(r.start).toEqual(d(19));
    expect(r.end).toEqual(d(22));
    expect(r.picking).toBe("start");
  });

  it("aralık seçiliyken yeni dokunuş yeni tek gün başlatır", () => {
    const r = nextRange(d(21), d(23), d(22), "start", 30);
    expect(r).toEqual({ start: d(22), end: d(22), picking: "end" });
  });

  it("başlangıçtan önceki gün yeni başlangıç olur", () => {
    const r = nextRange(d(21), d(21), d(19), "end", 30);
    expect(r).toEqual({ start: d(19), end: d(19), picking: "end" });
  });

  it("aynı güne dokunmak tek gün bırakır", () => {
    const r = nextRange(d(21), d(21), d(21), "end", 30);
    expect(r).toEqual({ start: d(21), end: d(21), picking: "end" });
  });

  it("en fazla maxDays gün", () => {
    const r = nextRange(d(1), d(1), d(31), "end", 7);
    expect(r.end).toEqual(new Date(d(1).getTime() + 7 * 24 * 60 * 60 * 1000));
  });
});
