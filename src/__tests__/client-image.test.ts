import { describe, it, expect } from "vitest";

import { MAX_UPLOAD_EDGE, fitWithin } from "@/lib/client-image";

describe("fitWithin", () => {
  it("büyük yatay görsel uzun kenarı sınıra iner, oran korunur", () => {
    expect(fitWithin(4096, 3072)).toEqual({ width: MAX_UPLOAD_EDGE, height: 1536 });
  });

  it("dikey görsel yüksekliğe göre küçülür", () => {
    expect(fitWithin(3000, 4000)).toEqual({ width: 1536, height: MAX_UPLOAD_EDGE });
  });

  it("sınırın altındaki görsele dokunulmaz", () => {
    expect(fitWithin(1828, 1208)).toEqual({ width: 1828, height: 1208 });
  });
});
