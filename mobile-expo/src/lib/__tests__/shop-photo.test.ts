import { describe, expect, it } from "@jest/globals";

import { MAX_PHOTO_EDGE, resizeTarget } from "../shop-photo";

describe("resizeTarget", () => {
  it("50 MP yatay fotoğraf genişliğe göre küçülür", () => {
    expect(resizeTarget(8160, 6120)).toEqual({ width: MAX_PHOTO_EDGE });
  });

  it("dikey fotoğraf yüksekliğe göre küçülür", () => {
    expect(resizeTarget(3000, 4000)).toEqual({ height: MAX_PHOTO_EDGE });
  });

  it("zaten küçük fotoğrafa dokunulmaz", () => {
    expect(resizeTarget(1600, 1200)).toBeNull();
    expect(resizeTarget(MAX_PHOTO_EDGE, MAX_PHOTO_EDGE)).toBeNull();
  });

  it("boyutu bilinmeyen varlıkta küçültme denenmez", () => {
    expect(resizeTarget(0, 0)).toBeNull();
  });
});
