import { describe, expect, it } from "@jest/globals";

import { flattenPages, mergeUniqueById, nextCursorOf } from "../paging";

describe("paging", () => {
  it("sayfalari sirayi koruyarak birlestirir, tekrar eden kaydi ilk gorulen haliyle tutar", () => {
    const a = [{ id: "1", v: "yeni" }, { id: "2", v: "x" }];
    const b = [{ id: "2", v: "eski" }, { id: "3", v: "y" }];
    expect(mergeUniqueById(a, b)).toEqual([{ id: "1", v: "yeni" }, { id: "2", v: "x" }, { id: "3", v: "y" }]);
  });

  it("veri yokken bos liste", () => {
    expect(flattenPages<{ items: { id: string }[] }, { id: string }>(undefined, (p) => p.items)).toEqual([]);
    expect(flattenPages({ pages: [{ items: [{ id: "a" }] }, { items: [{ id: "b" }] }] }, (p) => p.items)).toEqual([
      { id: "a" },
      { id: "b" },
    ]);
  });

  it("eski sunucu nextCursor gondermezse devam yok", () => {
    expect(nextCursorOf({})).toBeUndefined();
    expect(nextCursorOf({ nextCursor: null })).toBeUndefined();
    expect(nextCursorOf({ nextCursor: "c1" })).toBe("c1");
  });
});
